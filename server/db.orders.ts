/**
 * db.orders.ts — Pedidos / Reservas de Pagamento
 *
 * Fluxo:
 * 1. Cliente clica em "Comprar" → cria reserva (status RESERVADO)
 *    - Desconta 1 unidade do estoque temporariamente
 *    - expires_at = agora + 2h
 * 2. Admin confirma pagamento manualmente → status vira PAGO
 *    - Desconta definitivamente do estoque (stockQuantity)
 * 3. Se não confirmado em 2h → job de expiração devolve ao estoque
 * 4. Cliente pode cancelar antes da confirmação → devolve ao estoque
 */

import { and, desc, eq, lt, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  products,
} from "../drizzle/schema";
import {
  orders,
  type Order,
  type InsertOrder,
} from "../drizzle/schema.orders";

const RESERVATION_HOURS = 2;

// ── Criar reserva ─────────────────────────────────────────────────────────────

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

  // Verificar estoque disponível (descontando reservas ativas)
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
  const expiresAt = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);

  // Criar o pedido
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
      status: "RESERVADO",
      expiresAt,
    } as InsertOrder)
    .returning();

  // Descontar do estoque temporariamente
  await db
    .update(products)
    .set({
      stockQuantity: Math.max(0, availableStock - data.quantity),
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.productId));

  return order;
}

// ── Confirmar pagamento (admin) ───────────────────────────────────────────────

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
  if (existing[0].status !== "RESERVADO" && existing[0].status !== "AGUARDANDO_PAGAMENTO") {
    throw new Error(`Pedido não pode ser confirmado (status: ${existing[0].status})`);
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

// ── Cancelar pedido ───────────────────────────────────────────────────────────

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

  const cancellableStatuses = ["RESERVADO", "AGUARDANDO_PAGAMENTO"];
  if (!cancellableStatuses.includes(existing[0].status)) {
    throw new Error(`Pedido não pode ser cancelado (status: ${existing[0].status})`);
  }

  // Devolver ao estoque
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, existing[0].productId))
    .limit(1);

  if (product[0]) {
    await db
      .update(products)
      .set({
        stockQuantity: (product[0].stockQuantity ?? 0) + existing[0].quantity,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing[0].productId));
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

// ── Expirar reservas vencidas (job) ──────────────────────────────────────────

export async function expireStaleReservations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();

  // Buscar reservas vencidas
  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["RESERVADO", "AGUARDANDO_PAGAMENTO"]),
        lt(orders.expiresAt, now)
      )
    );

  if (stale.length === 0) return 0;

  // Devolver estoque para cada produto
  for (const order of stale) {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1);

    if (product[0]) {
      await db
        .update(products)
        .set({
          stockQuantity: (product[0].stockQuantity ?? 0) + order.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, order.productId));
    }
  }

  // Marcar como expirado
  const ids = stale.map((o) => o.id);
  await db
    .update(orders)
    .set({ status: "EXPIRADO", updatedAt: new Date() })
    .where(inArray(orders.id, ids));

  console.log(`[orders] ${stale.length} reserva(s) expirada(s)`);
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
  if (filters?.productId) conditions.push(eq(orders.productId, filters.productId));

  const rows = await db
    .select({
      order: orders,
      productName: products.name,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({
    ...r.order,
    productName: r.productName ?? "Produto removido",
  }));
}

export async function getOrderById(id: number): Promise<(Order & { productName: string }) | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      order: orders,
      productName: products.name,
    })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return { ...rows[0].order, productName: rows[0].productName ?? "Produto removido" };
}

// Contadores para dashboard
export async function getOrderCounts(): Promise<{
  reservados: number;
  pagos: number;
  cancelados: number;
  expirados: number;
}> {
  const db = await getDb();
  if (!db) return { reservados: 0, pagos: 0, cancelados: 0, expirados: 0 };

  const all = await db.select({ status: orders.status }).from(orders);
  return {
    reservados: all.filter((o) => o.status === "RESERVADO" || o.status === "AGUARDANDO_PAGAMENTO").length,
    pagos: all.filter((o) => o.status === "PAGO").length,
    cancelados: all.filter((o) => o.status === "CANCELADO").length,
    expirados: all.filter((o) => o.status === "EXPIRADO").length,
  };
}
