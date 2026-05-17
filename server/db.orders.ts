/**
 * server/db.orders.ts — Pedidos (fluxo refatorado)
 *
 * NOVO FLUXO DE NEGÓCIO:
 * 1. Cliente clica "Ir para o pagamento" → pedido criado (AGUARDANDO_PAGAMENTO)
 *    - Estoque NÃO é debitado neste momento
 *    - Pedido já aparece no painel admin imediatamente
 * 2. Admin confirma pagamento manualmente → status vira "PAGO"
 *    - SOMENTE aqui o estoque é debitado (stockQuantity - quantity)
 *    - Gatilho FIFO: se estoque chegar a 0, próximo lote é ativado
 * 3. Admin pode cancelar sem impacto no estoque
 *    (estoque nunca foi debitado na criação)
 */

import { and, desc, eq, lt, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
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
  // expiresAt: 30 dias — apenas para fins de arquivamento/limpeza futura
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

// ── Confirmar pagamento (admin) — AQUI ocorre o débito de estoque ─────────────

export async function confirmOrder(
  orderId: number,
  adminUserId: number,
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

  const confirmable = ["AGUARDANDO_PAGAMENTO", "RESERVADO"];
  if (!confirmable.includes(existing[0].status)) {
    throw new Error(
      `Pedido não pode ser confirmado (status atual: ${existing[0].status})`
    );
  }

  // Debitar estoque SOMENTE na confirmação manual
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, existing[0].productId))
    .limit(1);

  if (!product[0]) throw new Error("Produto não encontrado ao confirmar");

  const currentStock = product[0].stockQuantity ?? 0;
  const newStock = Math.max(0, currentStock - existing[0].quantity);

  await db
    .update(products)
    .set({ stockQuantity: newStock, updatedAt: new Date() })
    .where(eq(products.id, existing[0].productId));

  // Gatilho FIFO: se estoque chegou a zero, ativar próximo lote
  if (newStock === 0) {
    try {
      const { activateNextBatchIfNeeded } = await import("./db.batches");
      await activateNextBatchIfNeeded(existing[0].productId);
    } catch (err) {
      console.warn("[orders] activateNextBatchIfNeeded indisponível:", err);
    }
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "PAGO",
      confirmedAt: new Date(),
      confirmedBy: adminUserId,
      adminNotes: adminNotes ?? existing[0].adminNotes,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
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

  // Sem devolução de estoque — o estoque nunca foi debitado na criação

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

// ── Job de expiração (apenas cosmético — sem impacto de estoque) ──────────────

export async function expireStaleReservations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Verificar se a tabela existe antes de tentar a query
  try {
    const tableCheck = await db.execute(
      `SELECT 1 FROM information_schema.tables
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

  // No novo fluxo, a expiração NÃO devolve estoque (nunca foi debitado)
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
  return { ...rows[0].order, productName: rows[0].productName ?? "Produto removido" };
}

export async function getOrderCounts(): Promise<{
  aguardando: number;
  pagos: number;
  cancelados: number;
  expirados: number;
}> {
  const db = await getDb();
  if (!db) return { aguardando: 0, pagos: 0, cancelados: 0, expirados: 0 };

  const all = await db.select({ status: orders.status }).from(orders);
  return {
    aguardando: all.filter(
      (o) =>
        o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO"
    ).length,
    pagos: all.filter((o) => o.status === "PAGO").length,
    cancelados: all.filter((o) => o.status === "CANCELADO").length,
    expirados: all.filter((o) => o.status === "EXPIRADO").length,
  };
}
