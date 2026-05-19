/**
 * server/db.orders.ts — Pedidos (fluxo com confirmação atômica)
 *
 * FLUXO DE NEGÓCIO:
 * 1. Cliente cria pedido → status AGUARDANDO_PAGAMENTO (sem débito de estoque)
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

export async function createOrder(data: {
  productId: number;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  buyerContactType: string;
  paymentMethod: "PIX" | "CARTAO" | "BOLETO";
  unitPrice: number;
}): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, data.productId))
    .limit(1);

  if (!product[0]) throw new Error("Produto não encontrado");
  if (!product[0].published) throw new Error("Produto não disponível");

  const availableStock = product[0].stockQuantity ?? 0;
  if (availableStock < data.quantity) {
    throw new Error("Estoque insuficiente");
  }

  const totalPrice = data.unitPrice * data.quantity;
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
      unitPrice: data.unitPrice,
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
    // 1. Buscar pedido
    const existingRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!existingRows[0]) throw new Error("Pedido não encontrado");
    const existing = existingRows[0];

    // 2. Validar status permitido
    const confirmable = ["AGUARDANDO_PAGAMENTO", "RESERVADO"];
    if (!confirmable.includes(existing.status)) {
      throw new Error(
        `Pedido não pode ser confirmado (status atual: ${existing.status})`
      );
    }

    // 3. Buscar produto
    const productRows = await tx
      .select()
      .from(products)
      .where(eq(products.id, existing.productId))
      .limit(1);

    if (!productRows[0]) throw new Error("Produto não encontrado ao confirmar");
    const product = productRows[0];

    // 4. Validar estoque suficiente — erro explícito, sem Math.max silencioso
    const currentStock = product.stockQuantity ?? 0;
    if (currentStock < existing.quantity) {
      throw new Error(
        `Estoque insuficiente: disponível ${currentStock}, necessário ${existing.quantity}`
      );
    }

    const newStock = currentStock - existing.quantity;

    // 5. Debitar estoque do produto
    await tx
      .update(products)
      .set({
        stockQuantity: newStock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.productId));

    // 6. Registrar saída em stock_entries (quantity negativo = saída)
    await tx.insert(stockEntries).values({
      productId: existing.productId,
      userId: adminUserId,
      quantity: -existing.quantity,          // negativo = saída
      unitCost: product.finalUnitCostBrl ?? product.averageCostBrl ?? 0,
      notes: `Saída por venda — Pedido #${orderId}${adminNotes ? ` | ${adminNotes}` : ""}`,
    });

    // 7. Marcar pedido como PAGO
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

    // 8. Gatilho FIFO reservado para implementação futura

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
