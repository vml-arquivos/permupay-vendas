import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";
import { products } from "../drizzle/schema";
import { commissions, sellers, type InsertSeller, type Seller } from "../drizzle/schema.sellers";

export type SellerType = "INTERNO" | "EXTERNO";
export type CommissionType = "PERCENT" | "FIXED";
export type CommissionStatus = "PENDENTE" | "PAGO" | "PAGA" | "CANCELADA";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 60);
}

function generatedCode(): string {
  return `VEN-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function generatedAccessToken(): string {
  return randomBytes(32).toString("hex");
}

function validateCommission(type: CommissionType, value: number): void {
  if (!Number.isFinite(value) || value < 0 || (type === "PERCENT" && value > 100)) {
    throw new Error(type === "PERCENT" ? "A comissão percentual deve estar entre 0% e 100%" : "A comissão fixa não pode ser negativa");
  }
}

export async function createSeller(data: {
  name: string;
  type?: SellerType;
  email?: string;
  phone?: string;
  contact?: string;
  referralCode?: string;
  accessToken?: string | null;
  commissionType?: CommissionType;
  commissionValue?: number;
  commissionRate?: number;
  active?: boolean;
  userId?: number | null;
}): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  if (!name) throw new Error("Nome do vendedor é obrigatório");
  const type = data.type ?? "EXTERNO";
  const commissionType = data.commissionType ?? "PERCENT";
  const commissionValue = Number(data.commissionValue ?? data.commissionRate ?? 0);
  validateCommission(commissionType, commissionValue);
  const referralCode = normalizeCode(data.referralCode || generatedCode());
  if (!referralCode) throw new Error("Código de indicação inválido");

  const [created] = await db.insert(sellers).values({
    name,
    type,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    contact: data.contact?.trim() || data.phone?.trim() || null,
    referralCode,
    accessToken: type === "EXTERNO" ? (data.accessToken?.trim() || generatedAccessToken()) : null,
    commissionType,
    commissionValue,
    commissionRate: commissionType === "PERCENT" ? commissionValue : Number(data.commissionRate ?? 0),
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

export async function getSellerByReferralCode(referralCode: string, onlyActive = true): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const code = normalizeCode(referralCode);
  if (!code) return null;
  const conditions = [eq(sellers.referralCode, code)];
  if (onlyActive) conditions.push(eq(sellers.active, true));
  const [seller] = await db.select().from(sellers).where(and(...conditions)).limit(1);
  return seller ?? null;
}

export async function getSellerByAccessToken(accessToken: string, onlyActive = true): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(sellers.accessToken, accessToken.trim()), eq(sellers.type, "EXTERNO")];
  if (onlyActive) conditions.push(eq(sellers.active, true));
  const [seller] = await db.select().from(sellers).where(and(...conditions)).limit(1);
  return seller ?? null;
}

export async function getSellerByToken(referralCode: string, accessToken: string, onlyActive = true): Promise<Seller | null> {
  const seller = await getSellerByAccessToken(accessToken, onlyActive);
  if (!seller || seller.referralCode !== normalizeCode(referralCode)) return null;
  return seller;
}

export async function updateSeller(id: number, data: {
  name?: string;
  type?: SellerType;
  email?: string | null;
  phone?: string | null;
  contact?: string | null;
  referralCode?: string;
  accessToken?: string | null;
  commissionType?: CommissionType;
  commissionValue?: number;
  commissionRate?: number;
  active?: boolean;
  userId?: number | null;
}): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update: Partial<InsertSeller> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.type !== undefined) update.type = data.type;
  if (data.email !== undefined) update.email = data.email?.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
  if (data.contact !== undefined) update.contact = data.contact?.trim() || null;
  if (data.referralCode !== undefined) update.referralCode = normalizeCode(data.referralCode);
  if (data.accessToken !== undefined) update.accessToken = data.accessToken?.trim() || null;
  if (data.commissionType !== undefined) update.commissionType = data.commissionType;
  if (data.commissionValue !== undefined || data.commissionType !== undefined) {
    const commissionType = data.commissionType ?? "PERCENT";
    const commissionValue = Number(data.commissionValue ?? 0);
    validateCommission(commissionType, commissionValue);
    update.commissionValue = commissionValue;
    update.commissionRate = commissionType === "PERCENT" ? commissionValue : Number(data.commissionRate ?? 0);
  } else if (data.commissionRate !== undefined) {
    validateCommission("PERCENT", data.commissionRate);
    update.commissionRate = data.commissionRate;
    update.commissionValue = data.commissionRate;
    update.commissionType = "PERCENT";
  }
  if (data.active !== undefined) update.active = data.active;
  if (data.userId !== undefined) update.userId = data.userId;
  if (update.type === "INTERNO") update.accessToken = null;
  const [updated] = await db.update(sellers).set(update).where(eq(sellers.id, id)).returning();
  if (!updated) throw new Error("Vendedor não encontrado");
  return updated;
}

export async function deactivateSeller(id: number): Promise<Seller> {
  return updateSeller(id, { active: false });
}

export async function deleteSeller(id: number): Promise<{ success: true }> {
  return deactivateSeller(id).then(() => ({ success: true }));
}

export async function getExternalCatalog(accessToken: string) {
  const seller = await getSellerByAccessToken(accessToken, true);
  if (!seller) throw new Error("Código ou token de vendedor inválido ou inativo");
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
  const { accessToken: _accessToken, ...safeSeller } = seller;
  return { seller: safeSeller, products: catalog };
}

export async function createDirectOrder(data: {
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
  paymentMethod: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
  markAsPaid: boolean;
  allowBelowCost?: boolean;
}) {
  return dbOrders.createSellerOrder(data);
}

export async function listCommissions(filters?: { sellerId?: number; status?: CommissionStatus }) {
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
      saleAmount: commissions.saleAmount,
      costAmount: commissions.costAmount,
      commissionAmount: commissions.commissionAmount,
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
    .set({ status: "PAGA", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(commissions.id, id))
    .returning();
  if (!updated) throw new Error("Comissão não encontrada");
  return updated;
}
