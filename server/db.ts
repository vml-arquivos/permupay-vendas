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


export async function listProducts(userId?: number) { const db = await getDb(); if (!db) return []; return db.select().from(products).where(userId ? eq(products.userId, userId) : undefined as any); }
export async function getProductById(id:number){ const db=await getDb(); if(!db) return undefined; const r=await db.select().from(products).where(eq(products.id,id)).limit(1); return r[0]; }
export async function createProduct(data:any){ const db=await getDb(); if(!db) throw new Error("Database not available"); const [r]=await db.insert(products).values(data).returning(); return r; }
export async function updateProduct(id:number,data:any){ const db=await getDb(); if(!db) throw new Error("Database not available"); const [r]=await db.update(products).set({...data,updatedAt:new Date()}).where(eq(products.id,id)).returning(); return r; }
export async function deactivateProduct(id:number){ return updateProduct(id,{active:false}); }
export async function duplicateProduct(id:number){ const p=await getProductById(id); if(!p) throw new Error('Produto não encontrado'); const {id:_,createdAt,updatedAt,...rest}=p as any; return createProduct({...rest,name:`${p.name} (Cópia)`}); }

export async function createSimulation(data:any){ const db=await getDb(); if(!db) throw new Error("Database not available"); const [r]=await db.insert(pricingSimulations).values(data).returning(); return r; }
export async function listSimulations(userId?:number){ const db=await getDb(); if(!db) return []; return db.select().from(pricingSimulations).where(userId ? eq(pricingSimulations.userId,userId) : undefined as any).orderBy(desc(pricingSimulations.createdAt)); }
export async function getSimulationById(id:number){ const db=await getDb(); if(!db) return undefined; const r=await db.select().from(pricingSimulations).where(eq(pricingSimulations.id,id)).limit(1); return r[0]; }
export async function deleteSimulation(id:number){ const db=await getDb(); if(!db) return; await db.delete(pricingSimulations).where(eq(pricingSimulations.id,id)); }
export async function duplicateSimulation(id:number){ const s=await getSimulationById(id); if(!s) throw new Error('Simulação não encontrada'); const {id:_,createdAt,updatedAt,...rest}=s as any; return createSimulation({...rest,name:`${s.name} (Cópia)`}); }
export async function getDashboardData(userId?:number){ const prods=await listProducts(userId); const sims=await listSimulations(userId); return {totalProducts:prods.length,activeProducts:prods.filter((p:any)=>p.active).length,totalSimulations:sims.length,lastSimulation:sims[0]??null,attentionCount:sims.filter((s:any)=>['RISCO','ATENCAO','PREJUIZO'].includes(s.diagnosis)).length,healthyCount:sims.filter((s:any)=>['SAUDAVEL','EXCELENTE'].includes(s.diagnosis)).length,recentSimulations:sims.slice(0,5)}; }
