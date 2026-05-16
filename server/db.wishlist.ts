/**
 * db.wishlist.ts — Funções de banco para Lista de Desejos
 */

import { and, desc, eq, sql } from "drizzle-orm";
import {
  wishlistRequests,
  type InsertWishlistRequest,
  type WishlistRequest,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Público — criar desejo ───────────────────────────────────────────────────

export async function createWishlistRequest(
  data: Omit<
    InsertWishlistRequest,
    "id" | "createdAt" | "updatedAt" | "status" | "attendedBy"
  >
): Promise<WishlistRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [entry] = await db
    .insert(wishlistRequests)
    .values({ ...data, status: "NOVO" })
    .returning();

  return entry!;
}

// ─── Público — listar por contato ─────────────────────────────────────────────

export async function getWishlistByContact(
  contact: string
): Promise<WishlistRequest[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(wishlistRequests)
    .where(eq(wishlistRequests.contact, contact))
    .orderBy(desc(wishlistRequests.createdAt))
    .limit(20);
}

// ─── Admin — listar todos ────────────────────────────────────────────────────

export async function listWishlistRequests(filters?: {
  status?: string;
  category?: string;
}): Promise<WishlistRequest[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) {
    conditions.push(
      eq(wishlistRequests.status, filters.status as WishlistRequest["status"])
    );
  }
  if (filters?.category) {
    conditions.push(eq(wishlistRequests.category, filters.category));
  }

  return db
    .select()
    .from(wishlistRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(wishlistRequests.createdAt));
}

// ─── Admin — atualizar status ─────────────────────────────────────────────────

export async function updateWishlistStatus(
  id: number,
  status: "NOVO" | "VISUALIZADO" | "CONTATADO" | "ATENDIDO" | "FECHADO",
  adminNotes?: string,
  attendedBy?: number
): Promise<WishlistRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(wishlistRequests)
    .set({
      status,
      adminNotes,
      attendedBy,
      updatedAt: new Date(),
    })
    .where(eq(wishlistRequests.id, id))
    .returning();

  return updated!;
}

// ─── Admin — deletar ──────────────────────────────────────────────────────────

export async function deleteWishlistRequest(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(wishlistRequests).where(eq(wishlistRequests.id, id));
}

// ─── Admin — contadores para dashboard ───────────────────────────────────────

export async function getWishlistCounts(): Promise<{
  total: number;
  novo: number;
  contatado: number;
  atendido: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, novo: 0, contatado: 0, atendido: 0 };

  try {
    const rows = await db
      .select({
        status: wishlistRequests.status,
        count: sql<number>`count(*)::int`,
      })
      .from(wishlistRequests)
      .groupBy(wishlistRequests.status);

    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.status] = r.count;
    });

    return {
      total: rows.reduce((s, r) => s + r.count, 0),
      novo: counts["NOVO"] ?? 0,
      contatado: counts["CONTATADO"] ?? 0,
      atendido: counts["ATENDIDO"] ?? 0,
    };
  } catch {
    // Tabela ainda não existe (migration pendente) — retorna zeros sem quebrar o dashboard
    return { total: 0, novo: 0, contatado: 0, atendido: 0 };
  }
}
