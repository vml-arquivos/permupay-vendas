import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, SafeUser, User, pricingSimulations, products, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes("localhost")
          ? false
          : { rejectUnauthorized: false },
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Helpers de usuário ───────────────────────────────────────────────────────

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0];
}

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role?: "user" | "admin";
}): Promise<SafeUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const insert: InsertUser = {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    passwordHash,
    role: data.role ?? "user",
  };

  const result = await db.insert(users).values(insert).returning();
  return toSafeUser(result[0]);
}

export async function verifyPassword(
  user: User,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users);
  return result.length;
}

// ─── Funções de Produtos ──────────────────────────────────────────────────────

export async function listProducts(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(products)
      .where(userId ? eq(products.userId, userId) : undefined as any)
      .orderBy(desc(products.createdAt));
  } catch (error) {
    console.error("[DB] Erro ao listar produtos:", error);
    return [];
  }
}

export async function getProductById(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const r = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), userId ? eq(products.userId, userId) : undefined as any))
      .limit(1);
    return r[0];
  } catch (error) {
    console.error("[DB] Erro ao buscar produto:", error);
    return undefined;
  }
}

export async function createProduct(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Validar dados obrigatórios
    if (!data.name || !data.category) {
      throw new Error("Nome e categoria são obrigatórios");
    }

    // Garantir que os números estejam corretos
    const productData = {
      name: String(data.name).trim(),
      category: data.category,
      ncm: data.ncm ? String(data.ncm).trim() : null,
      costPrice: Number(data.costPrice) || 0,
      packagingCost: Number(data.packagingCost) || 0,
      inboundShippingCost: Number(data.inboundShippingCost) || 0,
      operationalCost: Number(data.operationalCost) || 0,
      desiredMarginRate: Number(data.desiredMarginRate) || 0,
      taxRegime: data.taxRegime || "SIMPLES_NACIONAL",
      estimatedTaxRate: Number(data.estimatedTaxRate) || 0,
      notes: data.notes ? String(data.notes).trim() : null,
      userId: data.userId ? Number(data.userId) : null,
      active: data.active !== false,
    };

    const [r] = await db.insert(products).values(productData).returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao criar produto:", error);
    throw error;
  }
}

export async function updateProduct(id: number, data: any, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Atualizar apenas campos fornecidos
    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.ncm !== undefined) updateData.ncm = data.ncm ? String(data.ncm).trim() : null;
    if (data.costPrice !== undefined) updateData.costPrice = Number(data.costPrice) || 0;
    if (data.packagingCost !== undefined) updateData.packagingCost = Number(data.packagingCost) || 0;
    if (data.inboundShippingCost !== undefined) updateData.inboundShippingCost = Number(data.inboundShippingCost) || 0;
    if (data.operationalCost !== undefined) updateData.operationalCost = Number(data.operationalCost) || 0;
    if (data.desiredMarginRate !== undefined) updateData.desiredMarginRate = Number(data.desiredMarginRate) || 0;
    if (data.taxRegime !== undefined) updateData.taxRegime = data.taxRegime;
    if (data.estimatedTaxRate !== undefined) updateData.estimatedTaxRate = Number(data.estimatedTaxRate) || 0;
    if (data.notes !== undefined) updateData.notes = data.notes ? String(data.notes).trim() : null;
    if (data.active !== undefined) updateData.active = data.active;

    const [r] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, id), userId ? eq(products.userId, userId) : undefined as any))
      .returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao atualizar produto:", error);
    throw error;
  }
}

export async function deactivateProduct(id: number, userId?: number) {
  return updateProduct(id, { active: false }, userId);
}

export async function duplicateProduct(id: number, userId?: number) {
  const p = await getProductById(id, userId);
  if (!p) throw new Error("Produto não encontrado");
  const { id: _, createdAt, updatedAt, ...rest } = p as any;
  return createProduct({ ...rest, name: `${p.name} (Cópia)` });
}

// ─── Funções de Simulações ────────────────────────────────────────────────────

export async function createSimulation(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Validar dados obrigatórios
    if (!data.name) {
      throw new Error("Nome da simulação é obrigatório");
    }

    const simulationData = {
      name: String(data.name).trim(),
      productSnapshot: data.productSnapshot || {},
      taxSnapshot: data.taxSnapshot || {},
      paymentSnapshot: data.paymentSnapshot || {},
      resultSnapshot: data.resultSnapshot || {},
      bestPaymentMethod: String(data.bestPaymentMethod || "PIX"),
      worstPaymentMethod: String(data.worstPaymentMethod || "PIX"),
      recommendedPrice: Number(data.recommendedPrice) || 0,
      minimumBreakEvenPrice: Number(data.minimumBreakEvenPrice) || 0,
      promotionFloorPrice: Number(data.promotionFloorPrice) || 0,
      desiredMarginRate: Number(data.desiredMarginRate) || 0,
      diagnosis: String(data.diagnosis || "SAUDAVEL"),
      notes: data.notes ? String(data.notes).trim() : null,
      userId: data.userId ? Number(data.userId) : null,
      productId: data.productId ? Number(data.productId) : null,
    };

    const [r] = await db.insert(pricingSimulations).values(simulationData).returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao criar simulação:", error);
    throw error;
  }
}

export async function listSimulations(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(pricingSimulations)
      .where(userId ? eq(pricingSimulations.userId, userId) : undefined as any)
      .orderBy(desc(pricingSimulations.createdAt));
  } catch (error) {
    console.error("[DB] Erro ao listar simulações:", error);
    return [];
  }
}

export async function getSimulationById(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const r = await db
      .select()
      .from(pricingSimulations)
      .where(and(eq(pricingSimulations.id, id), userId ? eq(pricingSimulations.userId, userId) : undefined as any))
      .limit(1);
    return r[0];
  } catch (error) {
    console.error("[DB] Erro ao buscar simulação:", error);
    return undefined;
  }
}

export async function deleteSimulation(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(pricingSimulations).where(and(eq(pricingSimulations.id, id), userId ? eq(pricingSimulations.userId, userId) : undefined as any));
  } catch (error) {
    console.error("[DB] Erro ao deletar simulação:", error);
    throw error;
  }
}

export async function duplicateSimulation(id: number, userId?: number) {
  const s = await getSimulationById(id, userId);
  if (!s) throw new Error("Simulação não encontrada");
  const { id: _, createdAt, updatedAt, ...rest } = s as any;
  return createSimulation({ ...rest, name: `${s.name} (Cópia)` });
}

export async function getDashboardData(userId?: number) {
  const prods = await listProducts(userId);
  const sims = await listSimulations(userId);
  return {
    totalProducts: prods.length,
    activeProducts: prods.filter((p: any) => p.active).length,
    totalSimulations: sims.length,
    lastSimulation: sims[0] ?? null,
    attentionCount: sims.filter((s: any) =>
      ["RISCO", "ATENCAO", "PREJUIZO"].includes(s.diagnosis)
    ).length,
    healthyCount: sims.filter((s: any) =>
      ["SAUDAVEL", "EXCELENTE"].includes(s.diagnosis)
    ).length,
    recentSimulations: sims.slice(0, 5),
  };
}
