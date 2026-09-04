/**
 * server/db.orders.ts — Pedidos / Reservas com confirmação manual
 *
 * Fluxo:
 * 1. Cliente reserva produto → AGUARDANDO_PAGAMENTO, sem baixar estoque.
 * 2. Admin confirma recebimento → PAGO, baixa estoque uma única vez e sincroniza FIFO.
 * 3. Admin pode cancelar reserva pendente → CANCELADO, sem mexer no estoque.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { products, stockEntries } from "../drizzle/schema";
import { orders, type Order, type InsertOrder } from "../drizzle/schema.orders";
import { commissions, sellers } from "../drizzle/schema.sellers";

type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

const PAYMENT_METHOD_ENABLED_FIELD: Record<PaymentMethod, string> = {
  PIX: "pixEnabled",
  CARTAO: "cardEnabled",
  BOLETO: "boletoEnabled",
  DINHEIRO: "cashEnabled",
};

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  DINHEIRO: "Dinheiro",
};

/**
 * Validação server-side (não só de UI) de que o método de pagamento
 * escolhido está habilitado para o produto — tanto na vitrine pública
 * (createOrder) quanto na venda interna (createDirectSale). Bloqueia mesmo
 * que o cliente manipule a requisição para enviar um método desabilitado.
 *
 * Aceita o produto tanto no formato do Drizzle (camelCase: pixEnabled,
 * vindo de createOrder) quanto de SQL cru (snake_case: pix_enabled, vindo
 * de createDirectSale, que usa `SELECT * ... FOR UPDATE`).
 */
export function assertPaymentMethodEnabled(
  product: Record<string, unknown>,
  paymentMethod: PaymentMethod
): void {
  const camelKey = PAYMENT_METHOD_ENABLED_FIELD[paymentMethod];
  const snakeKey = camelKey.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
  const raw = product[camelKey] ?? product[snakeKey];
  // Ausência da coluna (ex.: mock de teste incompleto) é tratada como
  // habilitado — a coluna real tem DEFAULT true, então produtos antigos
  // nunca ficam bloqueados por acidente após a migração.
  const enabled = raw === undefined || raw === null ? true : raw === true || raw === "true";
  if (!enabled) {
    throw new Error(
      `Este produto não aceita pagamento via ${PAYMENT_METHOD_LABEL[paymentMethod]}. Escolha outra forma de pagamento.`
    );
  }
}

/**
 * Gera automaticamente as notas promissórias de um pedido em BOLETO — uma
 * por parcela, com dados reais do cliente (quando disponível) e da compra.
 * Nunca bloqueia nem interrompe a venda: qualquer falha aqui fica só em log.
 * Dinamicamente importa db.customers/db.promissoryNotes para não criar
 * dependência circular (db.customers.ts já importa este módulo).
 */
async function triggerPromissoryNotesForBoletoOrder(
  order: { id: number; totalPrice?: number; total_price?: number },
  opts: {
    installments: number | null;
    productName: string;
    buyerName: string;
    customerId: number | null;
  }
): Promise<void> {
  if (!opts.installments || opts.installments < 1) return;
  try {
    const { generatePromissoryNotesForOrder } = await import(
      "./db.promissoryNotes"
    );

    let issuer = {
      name: opts.buyerName,
      document: null as string | null,
      address: null as string | null,
    };
    if (opts.customerId) {
      try {
        const { getCustomerById } = await import("./db.customers");
        const customer = await getCustomerById(opts.customerId);
        if (customer) {
          const addressParts = [
            customer.address,
            customer.city,
            customer.state,
            customer.zipCode ? `CEP ${customer.zipCode}` : null,
          ].filter(Boolean);
          issuer = {
            name: customer.name || opts.buyerName,
            document: customer.cpf || null,
            address: addressParts.length ? addressParts.join(", ") : null,
          };
        }
      } catch (error) {
        console.error(
          "[orders] Falha ao buscar dados do cliente para a nota promissória:",
          error
        );
      }
    }

    await generatePromissoryNotesForOrder({
      orderId: Number(order.id),
      customerId: opts.customerId,
      productDescription: opts.productName,
      totalPrice: Number(order.totalPrice ?? order.total_price ?? 0),
      installments: opts.installments,
      purchaseDate: new Date(),
      issuer,
    });
  } catch (error) {
    console.error(
      `[orders] Falha ao gerar notas promissórias do pedido #${order.id}:`,
      error
    );
  }
}

function resolveOrderUnitPrice(
  product: typeof products.$inferSelect,
  paymentMethod: PaymentMethod
): number {
  const fallback = Number(product.suggestedPrice ?? 0);

  if (paymentMethod === "PIX") {
    const pixPrice = Number(product.suggestedPricePix ?? 0);
    return pixPrice > 0 ? pixPrice : fallback;
  }

  if (paymentMethod === "DINHEIRO") {
    const cashPrice = Number(product.suggestedPricePix ?? 0);
    return cashPrice > 0 ? cashPrice : fallback;
  }

  if (paymentMethod === "CARTAO") {
    const cardPrice = Number(product.suggestedPriceCard ?? 0);
    return cardPrice > 0 ? cardPrice : fallback;
  }

  if (paymentMethod === "BOLETO") {
    const boletoPrice = Number(product.suggestedPriceBoleto ?? 0);
    return boletoPrice > 0 ? boletoPrice : fallback;
  }

  return fallback;
}

export async function createOrder(
  data: {
    productId: number;
    quantity: number;
    buyerName: string;
    buyerContact: string;
    buyerContactType: string;
    paymentMethod: PaymentMethod;
    referralCode?: string;
    sellerId?: number;
    customerId?: number;
    checkoutGroupId?: string;
    channel?: string;
  },
  requireReferral = false
): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, data.productId))
    .limit(1);

  const product = productRows[0];
  if (!product) throw new Error("Produto não encontrado");
  if (!product.published || !product.active)
    throw new Error("Produto não disponível");
  assertPaymentMethodEnabled(product, data.paymentMethod);

  let sellerId: number | null = data.sellerId ?? null;
  let normalizedReferralCode: string | null = null;
  if (data.referralCode?.trim()) {
    const sellerRows = await db
      .select({ id: sellers.id, referralCode: sellers.referralCode })
      .from(sellers)
      .where(
        and(
          eq(sellers.referralCode, data.referralCode.trim().toUpperCase()),
          eq(sellers.active, true)
        )
      )
      .limit(1);
    const seller = sellerRows[0];
    if (!seller && requireReferral)
      throw new Error("Token de vendedor inválido ou inativo");
    if (seller) {
      sellerId = seller.id;
      normalizedReferralCode = seller.referralCode;
    }
  }
  if (requireReferral && !sellerId)
    throw new Error("Token de vendedor inválido ou inativo");

  // Identifica ou cria o cadastro do cliente (mesmo cadastro usado em
  // /clientes, no carrinho da loja de afiliados — createCartCheckout — e
  // nas vendas diretas). Garante um único histórico de compras por cliente,
  // por CPF/contato, não importa se ele comprou pela vitrine, pela página
  // principal ou por um catálogo de vendedor. Nunca bloqueia a compra: se o
  // vínculo com o cliente falhar por qualquer motivo, o pedido continua
  // sendo criado normalmente (compatível com o comportamento anterior).
  let customerId = data.customerId ?? null;
  if (!customerId) {
    try {
      const { identifyOrCreateCustomer } = await import("./db.customers");
      const customer = await identifyOrCreateCustomer({
        name: data.buyerName,
        contact: data.buyerContact,
        contactType: data.buyerContactType === "EMAIL" ? "EMAIL" : "WHATSAPP",
        referredBySellerReferralCode: normalizedReferralCode ?? undefined,
      });
      customerId = customer.id;
    } catch (error) {
      console.error("[orders] Falha ao vincular cliente ao pedido:", error);
    }
  }

  const quantity = Math.max(1, Number(data.quantity || 1));
  const availableStock = Number(product.stockQuantity ?? 0);
  if (availableStock < quantity) throw new Error("Estoque insuficiente");

  const unitPrice = resolveOrderUnitPrice(product, data.paymentMethod);
  if (unitPrice <= 0)
    throw new Error("Produto sem preço válido para esta forma de pagamento");

  const totalPrice = unitPrice * quantity;
  // Reserva curta para atendimento manual. Não baixa estoque automaticamente.
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);

  // Número de parcelas praticado nesta venda — só relevante para BOLETO.
  // Gravado no próprio pedido (e não só no produto) para nunca depender de
  // um valor de produto que pode mudar depois da compra.
  const installments =
    data.paymentMethod === "BOLETO"
      ? Math.max(1, Math.round(Number(product.boletoMonths ?? 1)))
      : null;

  const [order] = await db
    .insert(orders)
    .values({
      productId: data.productId,
      quantity,
      channel: data.channel ?? "VITRINE",
      buyerName: data.buyerName,
      buyerContact: data.buyerContact,
      buyerContactType: data.buyerContactType,
      paymentMethod: data.paymentMethod,
      unitPrice,
      totalPrice,
      installments,
      status: "AGUARDANDO_PAGAMENTO",
      expiresAt,
      sellerId,
      referralCode: normalizedReferralCode,
      customerId,
      checkoutGroupId: data.checkoutGroupId ?? null,
    } as InsertOrder)
    .returning();

  if (data.paymentMethod === "BOLETO") {
    await triggerPromissoryNotesForBoletoOrder(order, {
      installments,
      productName: product.name,
      buyerName: data.buyerName,
      customerId,
    });
  }

  return order;
}

async function applyStockDeductionForOrder(
  tx: any,
  order: any,
  product: any,
  stockUserId: number | null,
  adminNotes?: string
): Promise<void> {
  const orderId = Number(order.id);
  const productId = Number(order.product_id);
  const quantitySold = Number(order.quantity ?? 0);
  const currentStock = Number(product.stock_quantity ?? 0);
  if (currentStock < quantitySold) {
    throw new Error(
      `Estoque insuficiente: disponível ${currentStock}, necessário ${quantitySold}`
    );
  }

  const newStock = currentStock - quantitySold;
  await tx.execute(sql`
    UPDATE permupay_products
    SET stock_quantity = ${newStock}, updated_at = NOW()
    WHERE id = ${productId}
  `);
  await tx.insert(stockEntries).values({
    productId,
    userId: stockUserId,
    quantity: -quantitySold,
    unitCost: Number(
      product.final_unit_cost_brl ?? product.average_cost_brl ?? 0
    ),
    notes: `Saída por venda/reserva confirmada — Pedido #${orderId}${adminNotes ? ` | ${adminNotes}` : ""}`,
  });

  const activeQueueResult = (await tx.execute(sql`
    SELECT id, quantity_remaining
    FROM permupay_stock_queue
    WHERE product_id = ${productId} AND status = 'ATIVO'
    ORDER BY activated_at ASC NULLS LAST, created_at ASC
    LIMIT 1 FOR UPDATE
  `)) as any;
  const activeQueue = activeQueueResult?.rows?.[0];
  if (!activeQueue) return;

  const remainingBefore = Number(activeQueue.quantity_remaining ?? 0);
  const remainingAfter = Math.max(0, remainingBefore - quantitySold);
  await tx.execute(sql`
    UPDATE permupay_stock_queue
    SET quantity_remaining = ${remainingAfter}, updated_at = NOW()
    WHERE id = ${activeQueue.id}
  `);
  if (remainingAfter > 0 && newStock > 0) return;

  await tx.execute(sql`
    UPDATE permupay_stock_queue
    SET status = 'ESGOTADO', quantity_remaining = 0, exhausted_at = NOW(), updated_at = NOW()
    WHERE id = ${activeQueue.id}
  `);
  await tx.execute(sql`
    UPDATE permupay_batch_items SET queue_status = 'ESGOTADO' WHERE queue_id = ${activeQueue.id}
  `);

  const nextQueueResult = (await tx.execute(sql`
    SELECT id, quantity, quantity_remaining, unit_cost,
           suggested_price_pix, suggested_price_card, suggested_price_boleto, batch_id
    FROM permupay_stock_queue
    WHERE product_id = ${productId} AND status = 'EM_ESPERA'
    ORDER BY position ASC, created_at ASC
    LIMIT 1 FOR UPDATE
  `)) as any;
  const nextQueue = nextQueueResult?.rows?.[0];
  if (!nextQueue) return;

  const nextQty = Number(
    nextQueue.quantity_remaining ?? nextQueue.quantity ?? 0
  );
  await tx.execute(sql`
    UPDATE permupay_stock_queue
    SET status = 'ATIVO', quantity_remaining = ${nextQty},
        activated_at = COALESCE(activated_at, NOW()), updated_at = NOW()
    WHERE id = ${nextQueue.id}
  `);
  await tx.execute(sql`
    UPDATE permupay_products
    SET stock_quantity = ${nextQty},
        average_cost_brl = ${Number(nextQueue.unit_cost ?? 0)},
        final_unit_cost_brl = ${Number(nextQueue.unit_cost ?? 0)},
        suggested_price_pix = ${Number(nextQueue.suggested_price_pix ?? 0)},
        suggested_price_card = ${Number(nextQueue.suggested_price_card ?? 0)},
        suggested_price_boleto = ${Number(nextQueue.suggested_price_boleto ?? 0)},
        updated_at = NOW()
    WHERE id = ${productId}
  `);
  await tx.insert(stockEntries).values({
    productId,
    batchId: nextQueue.batch_id ?? null,
    userId: stockUserId,
    quantity: nextQty,
    unitCost: Number(nextQueue.unit_cost ?? 0),
    notes: `[VIRADA FIFO] Lote fila #${nextQueue.id} promovido para ATIVO após confirmação do pedido #${orderId}`,
  });
  await tx.execute(sql`
    UPDATE permupay_batch_items SET queue_status = 'ATIVO' WHERE queue_id = ${nextQueue.id}
  `);
}

async function registerCommissionIfApplicable(
  tx: any,
  order: any,
  product: any
): Promise<void> {
  const sellerId = Number(order.seller_id ?? 0);
  if (sellerId <= 0) return;
  const sellerResult = (await tx.execute(sql`
    SELECT id, commission_type, commission_value, commission_rate
    FROM permupay_sellers WHERE id = ${sellerId} LIMIT 1
  `)) as any;
  const seller = sellerResult?.rows?.[0];
  if (!seller) return;

  const saleAmount = Number(order.total_price ?? 0);
  const quantity = Number(order.quantity ?? 0);
  const costAmount = Number(
    (
      Number(product.final_unit_cost_brl ?? product.average_cost_brl ?? 0) *
      quantity
    ).toFixed(2)
  );
  const commissionType = String(seller.commission_type ?? "PERCENT");
  const commissionValue = Number(
    seller.commission_value ?? seller.commission_rate ?? 0
  );
  const commissionAmount = Number(
    (commissionType === "FIXED"
      ? commissionValue
      : (saleAmount * commissionValue) / 100
    ).toFixed(2)
  );

  await tx
    .insert(commissions)
    .values({
      orderId: Number(order.id),
      sellerId,
      orderTotal: saleAmount,
      commissionRate: commissionType === "PERCENT" ? commissionValue : 0,
      commissionValue: commissionAmount,
      saleAmount,
      costAmount,
      commissionAmount,
      status: "PENDENTE",
    })
    .onConflictDoNothing({ target: commissions.orderId });
}

export async function confirmOrder(
  orderId: number,
  adminUserId: number,
  adminNotes?: string,
  paymentMethod?: PaymentMethod
): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async tx => {
    const orderResult = (await tx.execute(sql`
      SELECT * FROM permupay_orders WHERE id = ${orderId} FOR UPDATE
    `)) as any;
    const existing = orderResult?.rows?.[0];
    if (!existing) throw new Error("Pedido não encontrado");
    if (
      !["AGUARDANDO_PAGAMENTO", "RESERVADO"].includes(String(existing.status))
    ) {
      throw new Error(
        `Pedido não pode ser confirmado (status atual: ${existing.status})`
      );
    }

    const finalMethod = (paymentMethod ??
      existing.payment_method) as PaymentMethod;
    const productResult = (await tx.execute(sql`
      SELECT * FROM permupay_products WHERE id = ${existing.product_id} FOR UPDATE
    `)) as any;
    const product = productResult?.rows?.[0];
    if (!product) throw new Error("Produto não encontrado ao confirmar");

    await applyStockDeductionForOrder(
      tx,
      existing,
      product,
      adminUserId,
      adminNotes
    );
    await registerCommissionIfApplicable(tx, existing, product);

    const [updated] = await tx
      .update(orders)
      .set({
        status: "PAGO",
        paymentMethod: finalMethod,
        confirmedAt: new Date(),
        confirmedBy: adminUserId,
        adminNotes: adminNotes ?? existing.admin_notes,
        updatedAt: new Date(),
      } as any)
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  });
}

export async function createSellerOrder(data: {
  sellerId?: number;
  referralCode?: string;
  accessToken?: string;
  requestingUserId?: number | null;
  productId: number;
  quantity: number;
  unitPrice: number;
  buyerName: string;
  buyerContact: string;
  buyerContactType: string;
  paymentMethod: PaymentMethod;
  markAsPaid: boolean;
  allowBelowCost?: boolean;
}): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Mesmo cadastro de cliente usado em /clientes e nas demais formas de
  // compra — resolvido fora da transação da venda para não misturar
  // conexões. Nunca bloqueia a venda: se falhar, o pedido segue normalmente.
  let customerId: number | null = null;
  try {
    const { identifyOrCreateCustomer } = await import("./db.customers");
    const customer = await identifyOrCreateCustomer({
      name: data.buyerName,
      contact: data.buyerContact,
      contactType: data.buyerContactType === "EMAIL" ? "EMAIL" : "WHATSAPP",
    });
    customerId = customer.id;
  } catch (error) {
    console.error("[orders] Falha ao vincular cliente à venda direta:", error);
  }

  const result = await db.transaction(async tx => {
    const sellerResult = data.sellerId
      ? ((await tx.execute(
          sql`SELECT * FROM permupay_sellers WHERE id = ${data.sellerId} AND active = TRUE LIMIT 1`
        )) as any)
      : data.accessToken
        ? ((await tx.execute(
            sql`SELECT * FROM permupay_sellers WHERE access_token = ${data.accessToken} AND type = 'EXTERNO' AND active = TRUE LIMIT 1`
          )) as any)
        : data.referralCode
          ? ((await tx.execute(
              sql`SELECT * FROM permupay_sellers WHERE referral_code = ${data.referralCode.trim().toUpperCase()} AND active = TRUE LIMIT 1`
            )) as any)
          : { rows: [] };
    const seller = sellerResult?.rows?.[0];
    if (!seller) throw new Error("Vendedor inválido ou inativo");

    const sellerType = String(seller.type ?? "EXTERNO");
    if (sellerType === "EXTERNO") {
      if (!data.accessToken || seller.access_token !== data.accessToken)
        throw new Error("Token de acesso do vendedor inválido");
      if (data.markAsPaid)
        throw new Error(
          "Vendas externas não podem ser marcadas como pagas pelo link público"
        );
    } else if (
      !data.requestingUserId ||
      Number(seller.user_id) !== Number(data.requestingUserId)
    ) {
      throw new Error(
        "Vendedor interno exige uma sessão autenticada do próprio vendedor"
      );
    }

    const productResult = (await tx.execute(
      sql`SELECT * FROM permupay_products WHERE id = ${data.productId} FOR UPDATE`
    )) as any;
    const product = productResult?.rows?.[0];
    if (!product || product.active === false)
      throw new Error("Produto não encontrado ou inativo");
    assertPaymentMethodEnabled(product, data.paymentMethod);

    const quantity = Math.max(1, Math.floor(Number(data.quantity || 1)));
    const currentStock = Number(product.stock_quantity ?? 0);
    if (currentStock < quantity) throw new Error("Estoque insuficiente");

    const unitPrice = Number(data.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0)
      throw new Error("Preço de venda inválido");
    const finalCost = Number(
      product.final_unit_cost_brl ??
        product.average_cost_brl ??
        product.cost_price ??
        0
    );
    if (!data.allowBelowCost && unitPrice < finalCost) {
      throw new Error(
        `O preço não pode ficar abaixo do custo do produto (R$ ${finalCost.toFixed(2)})`
      );
    }

    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const channel =
      sellerType === "INTERNO" ? "VENDEDOR_INTERNO" : "VENDEDOR_EXTERNO";
    const confirmedBy =
      data.requestingUserId ?? (seller.user_id ? Number(seller.user_id) : null);
    const installments =
      data.paymentMethod === "BOLETO"
        ? Math.max(1, Math.round(Number(product.boleto_months ?? 1)))
        : null;
    const [created] = await tx
      .insert(orders)
      .values({
        productId: data.productId,
        quantity,
        channel,
        sellerId: Number(seller.id),
        referralCode: seller.referral_code,
        customerId,
        buyerName: data.buyerName.trim(),
        buyerContact: data.buyerContact.trim(),
        buyerContactType: data.buyerContactType,
        paymentMethod: data.paymentMethod,
        unitPrice,
        totalPrice,
        installments,
        status: data.markAsPaid ? "PAGO" : "AGUARDANDO_PAGAMENTO",
        expiresAt,
        confirmedAt: data.markAsPaid ? new Date() : null,
        confirmedBy: data.markAsPaid ? confirmedBy : null,
      } as InsertOrder)
      .returning();

    if (!data.markAsPaid) return { created, installments, productName: String(product.name) };
    const orderForStock = {
      id: created.id,
      product_id: data.productId,
      quantity,
      total_price: totalPrice,
      seller_id: Number(seller.id),
    };
    await applyStockDeductionForOrder(
      tx,
      orderForStock,
      product,
      confirmedBy,
      "Venda direta registrada como paga"
    );
    await registerCommissionIfApplicable(tx, orderForStock, product);
    return { created, installments, productName: String(product.name) };
  });

  if (result.installments) {
    await triggerPromissoryNotesForBoletoOrder(result.created, {
      installments: result.installments,
      productName: result.productName,
      buyerName: result.created.buyerName,
      customerId: result.created.customerId,
    });
  }

  return result.created;
}

/**
 * Venda direta interna — usada pela tela "Nova Venda" do painel, tanto pelo
 * administrador quanto por um vendedor autenticado, sempre para um cliente
 * já cadastrado (permupay_customers). Não depende de link público/token,
 * diferente de `createSellerOrder` (que atende o fluxo de vendedor externo
 * via link). Reaproveita os mesmos helpers de baixa de estoque e comissão
 * para não duplicar regras de negócio.
 */
export async function createDirectSale(data: {
  customerId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  paymentMethod: PaymentMethod;
  markAsPaid: boolean;
  sellerId?: number | null;
  createdByUserId: number;
  allowBelowCost?: boolean;
  notes?: string;
}): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.transaction(async tx => {
    const customerResult = (await tx.execute(sql`
      SELECT id, name, contact, contact_type
      FROM permupay_customers WHERE id = ${data.customerId} LIMIT 1
    `)) as any;
    const customer = customerResult?.rows?.[0];
    if (!customer)
      throw new Error(
        "Cliente não encontrado. Cadastre o cliente antes de registrar a venda."
      );

    let sellerId: number | null = null;
    let referralCode: string | null = null;
    if (data.sellerId) {
      const sellerResult = (await tx.execute(sql`
        SELECT id, referral_code FROM permupay_sellers
        WHERE id = ${data.sellerId} AND active = TRUE LIMIT 1
      `)) as any;
      const seller = sellerResult?.rows?.[0];
      if (!seller) throw new Error("Vendedor inválido ou inativo");
      sellerId = Number(seller.id);
      referralCode = seller.referral_code;
    }

    const productResult = (await tx.execute(
      sql`SELECT * FROM permupay_products WHERE id = ${data.productId} FOR UPDATE`
    )) as any;
    const product = productResult?.rows?.[0];
    if (!product || product.active === false)
      throw new Error("Produto não encontrado ou inativo");
    assertPaymentMethodEnabled(product, data.paymentMethod);

    const quantity = Math.max(1, Math.floor(Number(data.quantity || 1)));
    const currentStock = Number(product.stock_quantity ?? 0);
    if (currentStock < quantity) throw new Error("Estoque insuficiente");

    const unitPrice = Number(data.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0)
      throw new Error("Preço de venda inválido");
    const finalCost = Number(
      product.final_unit_cost_brl ??
        product.average_cost_brl ??
        product.cost_price ??
        0
    );
    if (!data.allowBelowCost && unitPrice < finalCost) {
      throw new Error(
        `O preço não pode ficar abaixo do custo do produto (R$ ${finalCost.toFixed(2)})`
      );
    }

    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const channel = sellerId ? "VENDA_DIRETA_VENDEDOR" : "VENDA_DIRETA_ADMIN";
    const installments =
      data.paymentMethod === "BOLETO"
        ? Math.max(1, Math.round(Number(product.boleto_months ?? 1)))
        : null;

    const [created] = await tx
      .insert(orders)
      .values({
        productId: data.productId,
        quantity,
        channel,
        sellerId,
        referralCode,
        customerId: data.customerId,
        buyerName: String(customer.name),
        buyerContact: String(customer.contact),
        buyerContactType: String(customer.contact_type ?? "WHATSAPP"),
        paymentMethod: data.paymentMethod,
        unitPrice,
        totalPrice,
        installments,
        status: data.markAsPaid ? "PAGO" : "AGUARDANDO_PAGAMENTO",
        expiresAt,
        confirmedAt: data.markAsPaid ? new Date() : null,
        confirmedBy: data.markAsPaid ? data.createdByUserId : null,
        adminNotes: data.notes?.trim() || null,
      } as InsertOrder)
      .returning();

    if (!data.markAsPaid)
      return { created, installments, productName: String(product.name) };

    const orderForStock = {
      id: created.id,
      product_id: data.productId,
      quantity,
      total_price: totalPrice,
      seller_id: sellerId,
    };
    await applyStockDeductionForOrder(
      tx,
      orderForStock,
      product,
      data.createdByUserId,
      "Venda direta (Nova Venda) registrada como paga"
    );
    await registerCommissionIfApplicable(tx, orderForStock, product);
    return { created, installments, productName: String(product.name) };
  });

  if (result.installments) {
    await triggerPromissoryNotesForBoletoOrder(result.created, {
      installments: result.installments,
      productName: result.productName,
      buyerName: result.created.buyerName,
      customerId: result.created.customerId,
    });
  }

  return result.created;
}

export type CartCheckoutInput = {
  items: Array<{
    productId: number;
    quantity: number;
    paymentMethod: PaymentMethod;
  }>;
  customer: {
    name: string;
    contact: string;
    contactType?: "WHATSAPP" | "EMAIL";
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  referralCode?: string;
};

export async function createCartCheckout(data: CartCheckoutInput): Promise<{
  orders: Order[];
  checkoutGroupId: string;
  customerId: number;
}> {
  if (!data.items.length) throw new Error("O carrinho está vazio");

  const referralCode = data.referralCode?.trim().toUpperCase() || undefined;
  if (referralCode) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [seller] = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(
        and(eq(sellers.referralCode, referralCode), eq(sellers.active, true))
      )
      .limit(1);
    if (!seller) throw new Error("Link de loja inválido ou inativo");
  }

  const { identifyOrCreateCustomer } = await import("./db.customers");
  const customer = await identifyOrCreateCustomer({
    ...data.customer,
    referredBySellerReferralCode: referralCode,
  });
  const checkoutGroupId = randomUUID();
  const ordersCreated: Order[] = [];

  for (const item of data.items) {
    const order = await createOrder(
      {
        productId: item.productId,
        quantity: item.quantity,
        buyerName: customer.name,
        buyerContact: customer.contact,
        buyerContactType: customer.contactType,
        paymentMethod: item.paymentMethod,
        referralCode,
        customerId: customer.id,
        checkoutGroupId,
        channel: referralCode ? "LOJA_AFILIADO" : "VITRINE",
      },
      Boolean(referralCode)
    );
    ordersCreated.push(order);
  }

  return { orders: ordersCreated, checkoutGroupId, customerId: customer.id };
}

export async function cancelOrder(
  orderId: number,
  adminNotes?: string
): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!existing[0]) throw new Error("Pedido não encontrado");

  if (!["AGUARDANDO_PAGAMENTO", "RESERVADO"].includes(existing[0].status)) {
    throw new Error(
      `Pedido não pode ser cancelado (status atual: ${existing[0].status})`
    );
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "CANCELADO",
      cancelledAt: new Date(),
      adminNotes: adminNotes ?? existing[0].adminNotes,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

/**
 * Exclusão administrativa suprema de pedido.
 *
 * Uso principal: limpar pedidos de teste.
 * - Se o pedido estava PAGO, devolve a quantidade ao estoque do produto.
 * - Registra uma entrada positiva em stock_entries para auditoria.
 * - Tenta devolver saldo ao lote/fila ATIVO quando existir.
 * - Apaga o pedido no final.
 *
 * Observação: para produção real, prefira cancelar/estornar. Esta função é
 * intencionalmente administrativa para ambiente de manutenção/testes.
 */
export async function deleteOrder(
  orderId: number,
  adminUserId: number,
  restoreStock = true
): Promise<{ success: true; restoredQuantity: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async tx => {
    const orderResult = (await tx.execute(sql`
      SELECT *
      FROM permupay_orders
      WHERE id = ${orderId}
      FOR UPDATE
    `)) as any;
    const existing = orderResult?.rows?.[0];

    if (!existing) throw new Error("Pedido não encontrado");

    const productId = Number(existing.product_id ?? 0);
    const qty = Number(existing.quantity ?? 0);
    const wasPaid = String(existing.status) === "PAGO";
    let restoredQuantity = 0;

    if (restoreStock && wasPaid && productId > 0 && qty > 0) {
      const productResult = (await tx.execute(sql`
        SELECT id, stock_quantity, final_unit_cost_brl, average_cost_brl
        FROM permupay_products
        WHERE id = ${productId}
        FOR UPDATE
      `)) as any;
      const product = productResult?.rows?.[0];

      if (product) {
        const currentStock = Number(product.stock_quantity ?? 0);
        const newStock = currentStock + qty;

        await tx.execute(sql`
          UPDATE permupay_products
          SET stock_quantity = ${newStock},
              active = true,
              updated_at = NOW()
          WHERE id = ${productId}
        `);

        const activeQueueResult = (await tx.execute(sql`
          SELECT id, quantity_remaining
          FROM permupay_stock_queue
          WHERE product_id = ${productId}
            AND status = 'ATIVO'
          ORDER BY activated_at ASC NULLS LAST, created_at ASC
          LIMIT 1
          FOR UPDATE
        `)) as any;
        const activeQueue = activeQueueResult?.rows?.[0];

        if (activeQueue) {
          const queueRemaining =
            Number(activeQueue.quantity_remaining ?? 0) + qty;
          await tx.execute(sql`
            UPDATE permupay_stock_queue
            SET quantity_remaining = ${queueRemaining},
                updated_at = NOW()
            WHERE id = ${activeQueue.id}
          `);
        }

        await tx.insert(stockEntries).values({
          productId,
          userId: adminUserId,
          quantity: qty,
          unitCost: Number(
            product.final_unit_cost_brl ?? product.average_cost_brl ?? 0
          ),
          notes: `[ADMIN] Pedido #${orderId} apagado; estoque devolvido por limpeza/teste`,
        });

        restoredQuantity = qty;
      }
    }

    await tx.delete(orders).where(eq(orders.id, orderId));

    return { success: true as const, restoredQuantity };
  });
}

export async function expireStaleReservations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const tableCheck = (await db.execute(sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'permupay_orders'
      LIMIT 1
    `)) as any;
    if (!tableCheck.rows?.length) return 0;
  } catch {
    return 0;
  }

  const now = new Date();
  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["AGUARDANDO_PAGAMENTO", "RESERVADO"]),
        lt(orders.expiresAt, now)
      )
    );

  if (stale.length === 0) return 0;

  await db
    .update(orders)
    .set({ status: "EXPIRADO", updatedAt: new Date() })
    .where(
      inArray(
        orders.id,
        stale.map(o => o.id)
      )
    );

  console.log(`[orders] ${stale.length} pedido(s) expirado(s)`);
  return stale.length;
}

export async function listOrders(filters?: {
  status?: Order["status"];
  productId?: number;
  customerId?: number;
  // Paginação opcional — sem informar, mantém o comportamento anterior
  // (retorna tudo) para não quebrar nenhuma tela existente que já consome
  // esta função sem paginar.
  limit?: number;
  offset?: number;
}): Promise<
  (Order & { productName: string; productImageUrl: string | null })[]
> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) conditions.push(eq(orders.status, filters.status));
  if (filters?.productId)
    conditions.push(eq(orders.productId, filters.productId));
  if (filters?.customerId)
    conditions.push(eq(orders.customerId, filters.customerId));

  let query = db
    .select({
      order: orders,
      productName: products.name,
      productImageUrl: products.imageUrl,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt)) as any;

  if (filters?.limit !== undefined) {
    query = query.limit(Math.min(Math.max(filters.limit, 1), 200));
  }
  if (filters?.offset !== undefined) {
    query = query.offset(Math.max(filters.offset, 0));
  }

  const rows = await query;

  return rows.map((r: any) => ({
    ...r.order,
    productName: r.productName ?? "Produto removido",
    productImageUrl: r.productImageUrl ?? null,
  }));
}

/** Total de pedidos de um cliente — usado para paginação na página do cliente. */
export async function countCustomerOrders(customerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.customerId, customerId));
  return Number(row?.count ?? 0);
}

export async function getOrderById(
  id: number
): Promise<
  (Order & { productName: string; productImageUrl: string | null }) | null
> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      order: orders,
      productName: products.name,
      productImageUrl: products.imageUrl,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return {
    ...rows[0].order,
    productName: rows[0].productName ?? "Produto removido",
    productImageUrl: rows[0].productImageUrl ?? null,
  };
}

/**
 * Token público (não sequencial, não adivinhável) para o pedido — usado no
 * link de documentos enviado ao cliente por WhatsApp/e-mail, para ele baixar
 * comprovante e notas promissórias sem precisar logar. Gerado sob demanda e
 * salvo, para permanecer estável no mesmo pedido.
 */
export async function getOrGenerateAccessToken(orderId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select({ accessToken: orders.accessToken })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) throw new Error("Pedido não encontrado");
  if (row.accessToken) return row.accessToken;

  const token = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  await db
    .update(orders)
    .set({ accessToken: token })
    .where(eq(orders.id, orderId));
  return token;
}

export async function getOrderByAccessToken(
  token: string
): Promise<
  (Order & { productName: string; productImageUrl: string | null }) | null
> {
  if (!token || token.trim().length < 10) return null;
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      order: orders,
      productName: products.name,
      productImageUrl: products.imageUrl,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.accessToken, token.trim()))
    .limit(1);

  if (!rows[0]) return null;
  return {
    ...rows[0].order,
    productName: rows[0].productName ?? "Produto removido",
    productImageUrl: rows[0].productImageUrl ?? null,
  };
}

export type OrderStatusFilter =
  | "AGUARDANDO_PAGAMENTO"
  | "RESERVADO"
  | "PAGO"
  | "CANCELADO"
  | "EXPIRADO";

/**
 * Filtros dinâmicos do dashboard. `dateFrom`/`dateTo` são instantes ISO 8601
 * absolutos (ex.: `date.toISOString()`) — o cálculo do início/fim do período
 * (hoje, ontem, 7d, 30d, etc.) é feito no cliente usando o fuso horário local
 * do navegador, então o servidor só precisa comparar instantes, sem lidar
 * com conversão de fuso.
 */
export type DashboardOrderFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: OrderStatusFilter[];
  productId?: number[];
  sellerId?: number[];
  customerId?: number[];
};

/**
 * Constrói as condições de filtro (SQL WHERE) reutilizadas por
 * getOrderCounts. Extraída como função pura e exportada para poder ser
 * testada sem precisar de uma conexão real com o banco.
 */
export function buildOrderFilterConditions(filters?: DashboardOrderFilters) {
  const conditions: any[] = [];
  if (!filters) return conditions;

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!Number.isNaN(from.getTime())) conditions.push(sql`${orders.createdAt} >= ${from}`);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!Number.isNaN(to.getTime())) conditions.push(sql`${orders.createdAt} <= ${to}`);
  }
  if (filters.status?.length) {
    conditions.push(inArray(orders.status, filters.status));
  }
  if (filters.productId?.length) {
    conditions.push(inArray(orders.productId, filters.productId));
  }
  if (filters.sellerId?.length) {
    conditions.push(inArray(orders.sellerId, filters.sellerId));
  }
  if (filters.customerId?.length) {
    conditions.push(inArray(orders.customerId, filters.customerId));
  }
  return conditions;
}

/**
 * Contadores do dashboard — filtráveis por período (createdAt), status,
 * produto, vendedor e cliente. A filtragem acontece 100% no banco (SQL
 * WHERE + agregação condicional via FILTER), nunca trazendo a tabela
 * inteira para agregar em JS — importante para o dashboard continuar
 * rápido conforme o volume de pedidos cresce.
 */
export async function getOrderCounts(filters?: DashboardOrderFilters): Promise<{
  aguardando: number;
  pagos: number;
  cancelados: number;
  expirados: number;
  faturamento: number;
  ticketMedio: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      aguardando: 0,
      pagos: 0,
      cancelados: 0,
      expirados: 0,
      faturamento: 0,
      ticketMedio: 0,
    };
  }

  const conditions = buildOrderFilterConditions(filters);

  const [row] = await db
    .select({
      aguardando: sql<number>`count(*) filter (where ${orders.status} in ('AGUARDANDO_PAGAMENTO', 'RESERVADO'))`,
      pagos: sql<number>`count(*) filter (where ${orders.status} = 'PAGO')`,
      cancelados: sql<number>`count(*) filter (where ${orders.status} = 'CANCELADO')`,
      expirados: sql<number>`count(*) filter (where ${orders.status} = 'EXPIRADO')`,
      faturamento: sql<number>`coalesce(sum(${orders.totalPrice}) filter (where ${orders.status} = 'PAGO'), 0)`,
    })
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined);

  const aguardando = Number(row?.aguardando ?? 0);
  const pagos = Number(row?.pagos ?? 0);
  const cancelados = Number(row?.cancelados ?? 0);
  const expirados = Number(row?.expirados ?? 0);
  const faturamento = Number(row?.faturamento ?? 0);

  return {
    aguardando,
    pagos,
    cancelados,
    expirados,
    faturamento,
    ticketMedio: pagos > 0 ? faturamento / pagos : 0,
  };
}
