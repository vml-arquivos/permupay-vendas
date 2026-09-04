import bcrypt from "bcryptjs";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  customers,
  creditStatusHistory,
  customerCommunications,
  type Customer,
  type CustomerCreditStatus,
  type InsertCustomer,
  type SafeCustomer,
  type CustomerCommunicationChannel,
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

// ─── Segurança da área do cliente (senha) ──────────────────────────────────
// Mesmo padrão de hashing (bcryptjs, custo 12) já usado em server/db.ts para
// os usuários internos.

export function toSafeCustomer(customer: Customer): SafeCustomer {
  const { passwordHash: _removed, ...safe } = customer;
  return safe;
}

export async function verifyCustomerPassword(
  customer: Customer,
  password: string
): Promise<boolean> {
  if (!customer.passwordHash) return false;
  return bcrypt.compare(password, customer.passwordHash);
}

/**
 * Cria uma conta de cliente nova, já com senha — usado por
 * customerAuth.register quando ainda não existe nenhum cadastro para este
 * contato.
 */
export async function createCustomerWithPassword(data: {
  name: string;
  contact: string;
  contactType?: CustomerContactType;
  password: string;
}): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  const contact = normalizeCustomerContact(data.contact, data.contactType);
  if (name.length < 2) throw new Error("Nome é obrigatório");
  if (contact.length < 5) throw new Error("Contato inválido");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const [created] = await db
    .insert(customers)
    .values({
      name,
      contact,
      contactType:
        data.contactType ?? (contact.includes("@") ? "EMAIL" : "WHATSAPP"),
      passwordHash,
    })
    .returning();

  if (!created) throw new Error("Não foi possível criar a conta");
  return created;
}

/**
 * "Ativa" (define senha em) um cadastro de cliente que já existia sem senha
 * — criado antes desta funcionalidade, via reserva rápida, Nova Venda ou
 * cadastro interno pelo admin. Evita bloquear clientes antigos: eles
 * simplesmente usam "Criar conta" com o mesmo contato para ganhar acesso
 * com senha ao cadastro que já tinham.
 */
export async function claimExistingCustomer(
  customerId: number,
  data: { name?: string; password: string }
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const update: Partial<InsertCustomer> = {
    passwordHash,
    updatedAt: new Date(),
  };
  if (data.name?.trim()) update.name = data.name.trim();

  const [updated] = await db
    .update(customers)
    .set(update)
    .where(eq(customers.id, customerId))
    .returning();
  if (!updated) throw new Error("Cliente não encontrado");
  return updated;
}

export async function updateCustomerLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ lastSignedIn: new Date() })
    .where(eq(customers.id, id));
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

  // Guarda o status anterior antes de sobrescrever — é o que alimenta o
  // histórico de análise de crédito exibido na página do cliente.
  const [before] = await db
    .select({ creditStatus: customers.creditStatus })
    .from(customers)
    .where(eq(customers.id, params.customerId))
    .limit(1);

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

  // Nunca bloqueia a atualização de crédito se o log de histórico falhar
  // por algum motivo — o status em si já foi salvo com sucesso acima.
  try {
    await db.insert(creditStatusHistory).values({
      customerId: params.customerId,
      previousStatus: before?.creditStatus ?? null,
      newStatus: params.creditStatus,
      notes: cleanOptional(params.creditNotes) ?? null,
      creditLimit: params.creditLimit ?? null,
      changedByUserId: params.reviewerUserId ?? null,
    });
  } catch (error) {
    console.error("[customers] Falha ao registrar histórico de crédito:", error);
  }

  return updated;
}

/**
 * Histórico de análise de crédito de um cliente, mais recente primeiro —
 * paginado para clientes com muitas mudanças de status ao longo do tempo.
 */
export async function getCreditHistory(
  customerId: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(creditStatusHistory)
      .where(eq(creditStatusHistory.customerId, customerId))
      .orderBy(desc(creditStatusHistory.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(creditStatusHistory)
      .where(eq(creditStatusHistory.customerId, customerId)),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * Registra uma ação de envio (WhatsApp/e-mail) feita pelo atendente a
 * partir da página do cliente — trilha de auditoria. Isto NÃO é uma
 * confirmação de entrega do provedor (exigiria integração paga com API de
 * terceiros, não configurada neste ambiente) — é o registro de que a ação
 * foi disparada, por quem, quando e para qual contato.
 */
export async function logCustomerCommunication(params: {
  customerId: number;
  orderId?: number;
  channel: CustomerCommunicationChannel;
  purpose: string;
  target: string;
  messagePreview?: string;
  sentByUserId?: number;
}): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .insert(customerCommunications)
    .values({
      customerId: params.customerId,
      orderId: params.orderId ?? null,
      channel: params.channel,
      purpose: params.purpose,
      target: params.target,
      messagePreview: cleanOptional(params.messagePreview) ?? null,
      sentByUserId: params.sentByUserId ?? null,
    })
    .returning();
  return row as any;
}

/**
 * Trilha de auditoria de envios de um cliente, mais recente primeiro —
 * paginada.
 */
export async function listCustomerCommunications(
  customerId: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(customerCommunications)
      .where(eq(customerCommunications.customerId, customerId))
      .orderBy(desc(customerCommunications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customerCommunications)
      .where(eq(customerCommunications.customerId, customerId)),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}
