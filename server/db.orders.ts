/**
 * server/db.orders.ts — Pedidos (fluxo com confirmação atômica)
 *
 * FLUXO DE NEGÓCIO:
 * 1. Cliente cria pedido → status AGUARDANDO_PAGAMENTO (sem débito de estoque)
 *    - O preço é calculado no backend pelo produto e forma de pagamento
 *    - O backend ignora qualquer preço vindo do navegador
 * 2. Admin confirma manualmente → status PAGO
 *    - Valida estoque suficiente (lança erro se insuficiente — sem Math.max silencioso)
 *    - Debita stockQuantity em transação atômica
 *    - Registra saída em permupay_stock_entries (quantity negativo)
 *    - Atualiza confirmed_at / confirmed_by
 * 3. Admin pode cancelar → sem impacto no estoque (nunca foi debitado)
 */

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { products, stockEntries } from "../drizzle/schema";
import {
  orders,
  type Order,
  type InsertOrder,
} from "../drizzle/schema.orders";

// ── Criar pedido — SEM debitar estoque ────────────────────────────────────────

function resolveOrderUnitPrice(
  product: typeof products.$inferSelect,
  paymentMethod: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO"
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

export async function createOrder(data: {
  productId: number;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  buyerContactType: string;
  paymentMethod: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
}): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, data.productId))
    .limit(1);

  if (!product[0]) throw new Error("Produto não encontrado");
  if (!product[0].published || !product[0].active) {
    throw new Error("Produto não disponível");
  }

  const availableStock = product[0].stockQuantity ?? 0;
  if (availableStock < data.quantity) {
    throw new Error("Estoque insuficiente");
  }

  const unitPrice = resolveOrderUnitPrice(product[0], data.paymentMethod);
  if (unitPrice <= 0) {
    throw new Error("Produto sem preço válido para esta forma de pagamento");
  }

  const totalPrice = unitPrice * data.quantity;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [order] = await db
    .insert(orders)
    .values({
      productId: data.productId,
      quantity: data.quantity,
      buyerName: data.buyerName,
      buyerContact: data.buyerContact,
      buyerContactType: data.buyerContactType,
      paymentMethod: data.paymentMethod,
      unitPrice,
      totalPrice,
      status: "AGUARDANDO_PAGAMENTO",
      expiresAt,
    } as InsertOrder)
    .returning();

  return order;
}

// ── Confirmar pagamento (admin) — TRANSAÇÃO ATÔMICA ──────────────────────────
//
// Tudo ocorre em uma única transação:
//   1. busca e valida pedido
//   2. busca e valida produto
//   3. verifica estoque suficiente (erro explícito se insuficiente)
//   4. debita stockQuantity
//   5. insere registro em stock_entries (saída negativa)
//   6. atualiza pedido para PAGO
//
// Se qualquer etapa falhar, tudo é revertido.

export async function confirmOrder(
  orderId: number,
  adminUserId: number,
  adminNotes?: string
): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // 1. Buscar pedido com lock para impedir confirmação dupla.
    const orderResult = await tx.execute(
      sql`SELECT id,
                 product_id AS "productId",
                 quantity,
                 status,
                 admin_notes AS "adminNotes"
          FROM permupay_orders
          WHERE id = ${orderId}
          FOR UPDATE`
    ) as any;
    const existing = orderResult?.rows?.[0] as Order | undefined;

    if (!existing) throw new Error("Pedido não encontrado");

    // 2. Validar status permitido.
    const confirmable = ["AGUARDANDO_PAGAMENTO", "RESERVADO"];
    if (!confirmable.includes(existing.status)) {
      throw new Error(
        `Pedido não pode ser confirmado (status atual: ${existing.status})`
      );
    }

    // 3. Buscar produto com lock.
    const productResult = await tx.execute(
      sql`SELECT *
          FROM permupay_products
          WHERE id = ${existing.productId}
          FOR UPDATE`
    ) as any;
    const product = productResult?.rows?.[0];

    if (!product) throw new Error("Produto não encontrado ao confirmar");

    // 4. Validar estoque suficiente — erro explícito, sem Math.max silencioso.
    const currentStock = Number(product.stock_quantity ?? 0);
    const quantitySold = Number(existing.quantity ?? 0);
    if (currentStock < quantitySold) {
      throw new Error(
        `Estoque insuficiente: disponível ${currentStock}, necessário ${quantitySold}`
      );
    }

    const newStock = currentStock - quantitySold;

    // 5. Debitar estoque do produto.
    await tx.execute(
      sql`UPDATE permupay_products
          SET stock_quantity = ${newStock}, updated_at = NOW()
          WHERE id = ${existing.productId}`
    );

    // 6. Registrar saída em stock_entries (quantity negativo = saída).
    await tx.insert(stockEntries).values({
      productId: existing.productId,
      userId: adminUserId,
      quantity: -quantitySold,
      unitCost: Number(product.final_unit_cost_brl ?? product.average_cost_brl ?? 0),
      notes: `Saída por venda — Pedido #${orderId}${adminNotes ? ` | ${adminNotes}` : ""}`,
    });

    // 7. Atualizar a fila FIFO dentro da MESMA transação.
    // Importante: não chamamos triggerStockTransition aqui, porque ela também debita estoque.
    // O estoque já foi debitado acima; aqui apenas sincronizamos quantity_remaining e promovemos próximo lote se zerar.
    const activeQueueResult = await tx.execute(
      sql`SELECT id, quantity_remaining
          FROM permupay_stock_queue
          WHERE product_id = ${existing.productId}
            AND status = 'ATIVO'
          ORDER BY activated_at ASC NULLS LAST, created_at ASC
          LIMIT 1
          FOR UPDATE`
    ) as any;
    const activeQueue = activeQueueResult?.rows?.[0];

    if (activeQueue) {
      const remainingBefore = Number(activeQueue.quantity_remaining ?? 0);
      const remainingAfter = Math.max(0, remainingBefore - quantitySold);

      await tx.execute(
        sql`UPDATE permupay_stock_queue
            SET quantity_remaining = ${remainingAfter},
                updated_at = NOW()
            WHERE id = ${activeQueue.id}`
      );

      if (remainingAfter <= 0 || newStock <= 0) {
        // Marcar lote atual como esgotado.
        await tx.execute(
          sql`UPDATE permupay_stock_queue
              SET status = 'ESGOTADO',
                  quantity_remaining = 0,
                  exhausted_at = NOW(),
                  updated_at = NOW()
              WHERE id = ${activeQueue.id}`
        );

        await tx.execute(
          sql`UPDATE permupay_batch_items
              SET queue_status = 'ESGOTADO'
              WHERE queue_id = ${activeQueue.id}`
        );

        // Buscar próximo lote em espera.
        const nextQueueResult = await tx.execute(
          sql`SELECT id, quantity, quantity_remaining, unit_cost,
                     suggested_price_pix, suggested_price_card, suggested_price_boleto,
                     batch_id
              FROM permupay_stock_queue
              WHERE product_id = ${existing.productId}
                AND status = 'EM_ESPERA'
              ORDER BY position ASC, created_at ASC
              LIMIT 1
              FOR UPDATE`
        ) as any;
        const nextQueue = nextQueueResult?.rows?.[0];

        if (nextQueue) {
          const nextQty = Number(nextQueue.quantity_remaining ?? nextQueue.quantity ?? 0);

          await tx.execute(
            sql`UPDATE permupay_stock_queue
                SET status = 'ATIVO',
                    quantity_remaining = ${nextQty},
                    activated_at = COALESCE(activated_at, NOW()),
                    updated_at = NOW()
                WHERE id = ${nextQueue.id}`
          );

          await tx.execute(
            sql`UPDATE permupay_products SET
                  stock_quantity         = ${nextQty},
                  average_cost_brl       = ${Number(nextQueue.unit_cost ?? 0)},
                  final_unit_cost_brl    = ${Number(nextQueue.unit_cost ?? 0)},
                  suggested_price_pix    = ${Number(nextQueue.suggested_price_pix ?? 0)},
                  suggested_price_card   = ${Number(nextQueue.suggested_price_card ?? 0)},
                  suggested_price_boleto = ${Number(nextQueue.suggested_price_boleto ?? 0)},
                  updated_at             = NOW()
                WHERE id = ${existing.productId}`
          );

          await tx.insert(stockEntries).values({
            productId: existing.productId,
            batchId: nextQueue.batch_id ?? null,
            userId: adminUserId,
            quantity: nextQty,
            unitCost: Number(nextQueue.unit_cost ?? 0),
            notes: `[VIRADA FIFO] Lote fila #${nextQueue.id} promovido para ATIVO após confirmação do pedido #${orderId}`,
          });

          await tx.execute(
            sql`UPDATE permupay_batch_items
                SET queue_status = 'ATIVO'
                WHERE queue_id = ${nextQueue.id}`
          );
        }
      }
    }

    // 8. Marcar pedido como PAGO / liberado.
    const [updated] = await tx
      .update(orders)
      .set({
        status: "PAGO",
        confirmedAt: new Date(),
        confirmedBy: adminUserId,
        adminNotes: adminNotes ?? existing.adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    return updated;
  });
}

// ── Cancelar pedido — SEM devolver estoque (nunca foi debitado) ───────────────

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

  const cancellable = ["AGUARDANDO_PAGAMENTO", "RESERVADO"];
  if (!cancellable.includes(existing[0].status)) {
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

// ── Job de expiração ──────────────────────────────────────────────────────────

export async function expireStaleReservations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const tableCheck = await db.execute(
      sql`SELECT 1 FROM information_schema.tables
          WHERE table_name = 'permupay_orders' LIMIT 1`
    );
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

  const ids = stale.map((o) => o.id);
  await db
    .update(orders)
    .set({ status: "EXPIRADO", updatedAt: new Date() })
    .where(inArray(orders.id, ids));

  console.log(`[orders] ${stale.length} pedido(s) expirado(s)`);
  return stale.length;
}

// ── Listagem admin ────────────────────────────────────────────────────────────

export async function listOrders(filters?: {
  status?: Order["status"];
  productId?: number;
}): Promise<(Order & { productName: string })[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) conditions.push(eq(orders.status, filters.status));
  if (filters?.productId)
    conditions.push(eq(orders.productId, filters.productId));

  const rows = await db
    .select({ order: orders, productName: products.name })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({
    ...r.order,
    productName: r.productName ?? "Produto removido",
  }));
}

export async function getOrderById(
  id: number
): Promise<(Order & { productName: string }) | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ order: orders, productName: products.name })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return {
    ...rows[0].order,
    productName: rows[0].productName ?? "Produto removido",
  };
}

export async function getOrderCounts(): Promise<{
  aguardando: number;
  pagos: number;
  cancelados: number;
  expirados: number;
  faturamento: number;
  ticketMedio: number;
}> {
  const db = await getDb();
  if (!db)
    return {
      aguardando: 0,
      pagos: 0,
      cancelados: 0,
      expirados: 0,
      faturamento: 0,
      ticketMedio: 0,
    };

  const all = await db
    .select({ status: orders.status, totalPrice: orders.totalPrice })
    .from(orders);

  const pagos = all.filter((o) => o.status === "PAGO");
  const faturamento = pagos.reduce((acc, o) => acc + (o.totalPrice ?? 0), 0);
  const ticketMedio = pagos.length > 0 ? faturamento / pagos.length : 0;

  return {
    aguardando: all.filter(
      (o) => o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO"
    ).length,
    pagos: pagos.length,
    cancelados: all.filter((o) => o.status === "CANCELADO").length,
    expirados: all.filter((o) => o.status === "EXPIRADO").length,
    faturamento,
    ticketMedio,
  };
}
