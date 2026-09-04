import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  customers,
  type Customer,
  type CustomerCreditStatus,
  type InsertCustomer,
} from "../drizzle/schema.customers";
import { sellers } from "../drizzle/schema.sellers";
import { orders } from "../drizzle/schema.orders";
import { products } from "../drizzle/schema";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";

export type CustomerContactType = "WHATSAPP" | "EMAIL";

export type CustomerInput = {
  name: string;
  contact: string;
  contactType?: CustomerContactType;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  referredBySellerReferralCode?: string;
  // KYC / documentação (opcionais — preenchidos no cadastro completo)
  cpf?: string;
  rg?: string;
  birthDate?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  proofAddressUrl?: string;
};

export function normalizeCustomerContact(
  contact: string,
  contactType?: CustomerContactType
): string {
  const value = contact.trim();
  return contactType === "EMAIL" || value.includes("@")
    ? value.toLowerCase()
    : value.replace(/\D/g, "");
}

function cleanOptional(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

export function normalizeCpf(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

async function resolveSellerId(referralCode?: string): Promise<number | null> {
  if (!referralCode?.trim()) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = referralCode.trim().toUpperCase();
  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(and(eq(sellers.referralCode, normalized), eq(sellers.active, true)))
    .limit(1);
  return seller?.id ?? null;
}

export async function identifyOrCreateCustomer(
  data: CustomerInput
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  const contact = normalizeCustomerContact(data.contact, data.contactType);
  if (name.length < 2) throw new Error("Nome do cliente é obrigatório");
  if (contact.length < 5) throw new Error("Contato do cliente é inválido");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, contact.toLowerCase()))
    .limit(1);

  if (existing) {
    const update: Partial<InsertCustomer> = {
      name,
      contactType: data.contactType ?? existing.contactType,
      updatedAt: new Date(),
    };
    const optionalFields = [
      "email",
      "address",
      "city",
      "state",
      "zipCode",
      "rg",
      "documentFrontUrl",
      "documentBackUrl",
      "proofAddressUrl",
    ] as const;
    for (const field of optionalFields) {
      const value = cleanOptional(data[field]);
      if (value !== undefined) update[field] = value;
    }
    if (data.cpf !== undefined) update.cpf = normalizeCpf(data.cpf);
    if (data.birthDate !== undefined) {
      update.birthDate = cleanOptional(data.birthDate) ?? null;
    }
    const [updated] = await db
      .update(customers)
      .set(update)
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const referredBySellerId = await resolveSellerId(
    data.referredBySellerReferralCode
  );
  const [created] = await db
    .insert(customers)
    .values({
      name,
      contact,
      contactType:
        data.contactType ?? (contact.includes("@") ? "EMAIL" : "WHATSAPP"),
      email: cleanOptional(data.email) ?? null,
      address: cleanOptional(data.address) ?? null,
      city: cleanOptional(data.city) ?? null,
      state: cleanOptional(data.state)?.toUpperCase() ?? null,
      zipCode: cleanOptional(data.zipCode) ?? null,
      referredBySellerId,
      cpf: normalizeCpf(data.cpf),
      rg: cleanOptional(data.rg) ?? null,
      birthDate: cleanOptional(data.birthDate) ?? null,
      documentFrontUrl: cleanOptional(data.documentFrontUrl) ?? null,
      documentBackUrl: cleanOptional(data.documentBackUrl) ?? null,
      proofAddressUrl: cleanOptional(data.proofAddressUrl) ?? null,
    })
    .returning();

  if (!created) throw new Error("Não foi possível cadastrar o cliente");
  return created;
}

export async function getCustomerByContact(
  contact: string
): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizeCustomerContact(contact);
  if (!normalized) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, normalized.toLowerCase()))
    .limit(1);
  return customer ?? null;
}

export async function listCustomerOrders(customerId: number) {
  return dbOrders.listOrders({ customerId });
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return customer ?? null;
}

export type ListCustomersFilters = {
  search?: string;
  creditStatus?: CustomerCreditStatus;
};

export async function listCustomers(
  filters: ListCustomersFilters = {}
): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.contact, term),
        ilike(customers.email, term),
        ilike(customers.cpf, term)
      )
    );
  }
  if (filters.creditStatus) {
    conditions.push(eq(customers.creditStatus, filters.creditStatus));
  }

  const query = db.select().from(customers);
  const rows = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(customers.createdAt))
    : await query.orderBy(desc(customers.createdAt));
  return rows;
}

/**
 * Recomendações simples para a área do cliente: prioriza produtos publicados
 * das mesmas categorias que o cliente já comprou (excluindo o que ele já
 * levou); completa com os demais produtos publicados até o limite. Sem
 * histórico de compras (cliente novo ou não encontrado), cai para os
 * produtos publicados mais recentes — a mesma lista já usada na vitrine.
 */
export async function getRecommendedProducts(contact: string, limit = 8) {
  const { getPublishedProducts } = await import("./db.batches");
  const all = await getPublishedProducts();

  const customer = await getCustomerByContact(contact);
  if (!customer) return all.slice(0, limit);

  const db = await getDb();
  if (!db) return all.slice(0, limit);

  const purchasedRows = await db
    .select({ productId: products.id, category: products.category })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.customerId, customer.id));

  if (!purchasedRows.length) return all.slice(0, limit);

  const purchasedProductIds = new Set(purchasedRows.map(r => r.productId));
  const purchasedCategories = new Set(purchasedRows.map(r => r.category));

  const sameCategory = (all as any[]).filter(
    p => purchasedCategories.has(p.category) && !purchasedProductIds.has(p.id)
  );
  const others = (all as any[]).filter(
    p => !purchasedProductIds.has(p.id) && !purchasedCategories.has(p.category)
  );

  return [...sameCategory, ...others].slice(0, limit);
}

export async function updateCreditStatus(params: {
  customerId: number;
  creditStatus: CustomerCreditStatus;
  creditNotes?: string;
  creditLimit?: number;
  reviewerUserId?: number;
}): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const update: Partial<InsertCustomer> = {
    creditStatus: params.creditStatus,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (params.creditNotes !== undefined) {
    update.creditNotes = cleanOptional(params.creditNotes) ?? null;
  }
  if (params.creditLimit !== undefined) {
    update.creditLimit = params.creditLimit;
  }
  if (params.reviewerUserId !== undefined) {
    update.reviewedBy = params.reviewerUserId;
  }

  const [updated] = await db
    .update(customers)
    .set(update)
    .where(eq(customers.id, params.customerId))
    .returning();
  if (!updated) throw new Error("Cliente não encontrado");
  return updated;
}
