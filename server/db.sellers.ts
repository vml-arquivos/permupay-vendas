import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";
import { products } from "../drizzle/schema";
import { commissions, sellers, type InsertSeller, type Seller } from "../drizzle/schema.sellers";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function generatedCode(): string {
  return `VEN-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function createSeller(data: {
  name: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  commissionRate?: number;
  active?: boolean;
  userId?: number | null;
}): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  if (!name) throw new Error("Nome do vendedor é obrigatório");
  const commissionRate = Number(data.commissionRate ?? 5);
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    throw new Error("A comissão deve estar entre 0% e 100%");
  }
  const referralCode = normalizeCode(data.referralCode || generatedCode());
  if (!referralCode) throw new Error("Token de indicação inválido");

  const [created] = await db.insert(sellers).values({
    name,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    referralCode,
    commissionRate,
    active: data.active ?? true,
    userId: data.userId ?? null,
  } satisfies InsertSeller).returning();

  return created;
}

export async function listSellers(): Promise<Seller[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sellers).orderBy(desc(sellers.createdAt));
}

export async function getSellerById(id: number): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, id)).limit(1);
  return seller ?? null;
}

export async function getSellerByToken(referralCode: string, onlyActive = true): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const code = normalizeCode(referralCode);
  if (!code) return null;
  const conditions = [eq(sellers.referralCode, code)];
  if (onlyActive) conditions.push(eq(sellers.active, true));
  const [seller] = await db.select().from(sellers).where(and(...conditions)).limit(1);
  return seller ?? null;
}

export async function updateSeller(id: number, data: {
  name?: string;
  email?: string | null;
  phone?: string | null;
  referralCode?: string;
  commissionRate?: number;
  active?: boolean;
}): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update: Partial<InsertSeller> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.email !== undefined) update.email = data.email?.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
  if (data.referralCode !== undefined) update.referralCode = normalizeCode(data.referralCode);
  if (data.commissionRate !== undefined) {
    if (data.commissionRate < 0 || data.commissionRate > 100) throw new Error("A comissão deve estar entre 0% e 100%");
    update.commissionRate = data.commissionRate;
  }
  if (data.active !== undefined) update.active = data.active;
  const [updated] = await db.update(sellers).set(update).where(eq(sellers.id, id)).returning();
  if (!updated) throw new Error("Vendedor não encontrado");
  return updated;
}

export async function deleteSeller(id: number): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSellerById(id);
  if (!existing) throw new Error("Vendedor não encontrado");
  const commissionCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(commissions)
    .where(eq(commissions.sellerId, id));
  if (Number(commissionCount[0]?.count ?? 0) > 0) {
    throw new Error("Vendedor com comissões históricas não pode ser apagado; inative-o para preservar o histórico.");
  }
  await db.delete(sellers).where(eq(sellers.id, id));
  return { success: true };
}

export async function getExternalCatalog(referralCode: string) {
  const seller = await getSellerByToken(referralCode, true);
  if (!seller) throw new Error("Token de vendedor inválido ou inativo");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const catalog = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      imageUrl: products.imageUrl,
      shortDescription: products.shortDescription,
      description: products.description,
      suggestedPrice: products.suggestedPrice,
      suggestedPricePix: products.suggestedPricePix,
      suggestedPriceCard: products.suggestedPriceCard,
      suggestedPriceBoleto: products.suggestedPriceBoleto,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(and(eq(products.active, true), eq(products.published, true)))
    .orderBy(desc(products.updatedAt));
  return { seller, products: catalog };
}

export async function createDirectOrder(data: {
  referralCode: string;
  productId: number;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  buyerContactType: string;
  paymentMethod: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
}) {
  const seller = await getSellerByToken(data.referralCode, true);
  if (!seller) throw new Error("Token de vendedor inválido ou inativo");
  return dbOrders.createOrder({
    productId: data.productId,
    quantity: data.quantity,
    buyerName: data.buyerName,
    buyerContact: data.buyerContact,
    buyerContactType: data.buyerContactType,
    paymentMethod: data.paymentMethod,
    referralCode: seller.referralCode,
  }, true);
}

export async function listCommissions(filters?: { sellerId?: number; status?: "PENDENTE" | "PAGO" }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.sellerId) conditions.push(eq(commissions.sellerId, filters.sellerId));
  if (filters?.status) conditions.push(eq(commissions.status, filters.status));
  return db
    .select({
      id: commissions.id,
      orderId: commissions.orderId,
      sellerId: commissions.sellerId,
      orderTotal: commissions.orderTotal,
      commissionRate: commissions.commissionRate,
      commissionValue: commissions.commissionValue,
      status: commissions.status,
      paidAt: commissions.paidAt,
      createdAt: commissions.createdAt,
      sellerName: sellers.name,
      referralCode: sellers.referralCode,
    })
    .from(commissions)
    .innerJoin(sellers, eq(commissions.sellerId, sellers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(commissions.createdAt));
}

export async function markCommissionPaid(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(commissions)
    .set({ status: "PAGO", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(commissions.id, id))
    .returning();
  if (!updated) throw new Error("Comissão não encontrada");
  return updated;
}
