/**
 * db.batches.ts — Funções de banco para Lotes, Estoque e Marketplace
 *
 * Acrescente este arquivo em server/ e importe as funções em server/routers.ts
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  batchItems,
  pricingBatches,
  products,
  stockEntries,
  type BatchItem,
  type InsertBatchItem,
  type InsertPricingBatch,
  type InsertStockEntry,
  type PricingBatch,
} from "../drizzle/schema";
import {
  BatchItemInput,
  BatchPricingResult,
  calculateBatchPricing,
  isBatchPricingError,
} from "../shared/pricing.batch";
import { getDb } from "./db";

// ─── Lotes de Precificação ────────────────────────────────────────────────────

export async function createBatch(
  data: Omit<InsertPricingBatch, "id" | "createdAt" | "updatedAt">
): Promise<PricingBatch> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [batch] = await db
    .insert(pricingBatches)
    .values({
      ...data,
      status: "OPEN",
    })
    .returning();

  return batch!;
}

export async function listBatches(_userId?: number): Promise<PricingBatch[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pricingBatches)
    .orderBy(desc(pricingBatches.createdAt));
}

export async function getBatchById(
  batchId: number,
  _userId?: number
): Promise<(PricingBatch & { items: BatchItem[] }) | null> {
  const db = await getDb();
  if (!db) return null;

  const [batch] = await db
    .select()
    .from(pricingBatches)
    .where(eq(pricingBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  const items = await db
    .select()
    .from(batchItems)
    .where(eq(batchItems.batchId, batchId))
    .orderBy(batchItems.id);

  return { ...batch, items };
}

/**
 * Processa um lote completo:
 * 1. Calcula o rateio proporcional
 * 2. Persiste os batch_items com custos rateados
 * 3. Atualiza o totalCostOfGoods no lote
 * 4. Opcionalmente dá entrada de estoque nos produtos vinculados
 */
export async function processBatch(
  batchId: number,
  userId: number,
  items: BatchItemInput[],
  totalOperationalCost: number,
  commitToStock = false
): Promise<BatchPricingResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Acesso total: qualquer usuário autenticado pode processar qualquer lote.
  const [batch] = await db
    .select()
    .from(pricingBatches)
    .where(eq(pricingBatches.id, batchId))
    .limit(1);

  if (!batch) throw new Error("Lote não encontrado");
  if (batch.status === "CLOSED") throw new Error("Este lote já está fechado");

  // Calcular rateio
  const result = calculateBatchPricing({ items, totalOperationalCost });
  if (isBatchPricingError(result)) throw new Error(result.message);

  // Limpar itens anteriores do lote (re-processamento)
  await db.delete(batchItems).where(eq(batchItems.batchId, batchId));

  // Inserir itens com rateio calculado
  const insertData: InsertBatchItem[] = result.items.map((item) => ({
    batchId,
    productId: item.productId ?? null,
    productName: item.productName,
    unitCostBrl: item.unitCostBrl,
    quantity: item.quantity,
    totalItemCost: item.totalItemCost,
    allocatedOperationalCost: item.allocatedOperationalCost,
    finalUnitCost: item.finalUnitCost,
    desiredMarginRate: item.desiredMarginRate,
    suggestedPrice: item.suggestedPrice,
  }));

  await db.insert(batchItems).values(insertData);

  // Atualizar totais do lote
  await db
    .update(pricingBatches)
    .set({
      totalCostOfGoods: result.totalCostOfGoods,
      totalOperationalCost: result.totalOperationalCost,
      updatedAt: new Date(),
    })
    .where(eq(pricingBatches.id, batchId));

  // Opcional: dar entrada de estoque nos produtos vinculados
  if (commitToStock) {
    for (const item of result.items) {
      if (!item.productId) continue;

      // Registrar entrada de estoque
      const entry: InsertStockEntry = {
        productId: item.productId,
        batchId,
        userId,
        quantity: item.quantity,
        unitCost: item.finalUnitCost,
        notes: `Entrada via lote #${batchId}`,
      };
      await db.insert(stockEntries).values(entry);

      // Atualizar estoque e custo médio do produto (custo médio ponderado)
      const [current] = await db
        .select({
          stockQuantity: products.stockQuantity,
          averageCostBrl: products.averageCostBrl,
        })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (current) {
        const oldQty = current.stockQuantity ?? 0;
        const oldAvg = current.averageCostBrl ?? 0;
        const newQty = oldQty + item.quantity;
        // Custo médio ponderado: (qtd_antiga * custo_antigo + qtd_nova * custo_novo) / qtd_total
        const newAvg =
          newQty > 0
            ? (oldQty * oldAvg + item.quantity * item.finalUnitCost) / newQty
            : item.finalUnitCost;

        await db
          .update(products)
          .set({
            stockQuantity: newQty,
            averageCostBrl: newAvg,
            finalUnitCostBrl: item.finalUnitCost,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }
    }

    // Fechar o lote após entrada de estoque
    await db
      .update(pricingBatches)
      .set({ status: "CLOSED", updatedAt: new Date() })
      .where(eq(pricingBatches.id, batchId));
  }

  return result;
}

export async function deleteBatch(
  batchId: number,
  _userId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(pricingBatches)
    .where(eq(pricingBatches.id, batchId));
}

// ─── Estoque ──────────────────────────────────────────────────────────────────

export async function getStockEntries(productId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(stockEntries)
    .where(eq(stockEntries.productId, productId))
    .orderBy(desc(stockEntries.createdAt));
}

export async function adjustStock(
  productId: number,
  userId: number,
  quantity: number,
  unitCost: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(stockEntries).values({
    productId,
    userId,
    quantity,
    unitCost,
    notes: notes ?? "Ajuste manual de estoque",
  });

  // Atualizar estoque total
  await db
    .update(products)
    .set({
      stockQuantity: sql`${products.stockQuantity} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
}

// ─── Marketplace / Vitrine ────────────────────────────────────────────────────

export async function getPublishedProducts() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      categoryLabel: products.categoryLabel,
      shortDescription: products.shortDescription,
      description: products.description,
      imageUrl: products.imageUrl,
      promoTag: products.promoTag,
      suggestedPrice: products.suggestedPrice,
      suggestedPricePix: products.suggestedPricePix,
      suggestedPriceCard: products.suggestedPriceCard,
      suggestedPriceBoleto: products.suggestedPriceBoleto,
      stockQuantity: products.stockQuantity,
      minimumStock: products.minimumStock,
      paymentPlatform: products.paymentPlatform,
      pixKey: products.pixKey,
      pixLink: products.pixLink,
      cardPaymentUrl: products.cardPaymentUrl,
      boletoUrl: products.boletoUrl,
      cardInstallments: products.cardInstallments,
      boletoMonths: products.boletoMonths,
    })
    .from(products)
    .where(and(eq(products.published, true), eq(products.active, true)))
    .orderBy(asc(products.displayOrder), desc(products.createdAt));
}

export async function getPublishedProductsByCategory(category?: string) {
  const db = await getDb();
  if (!db) return [];

  const baseQuery = db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      categoryLabel: products.categoryLabel,
      shortDescription: products.shortDescription,
      description: products.description,
      imageUrl: products.imageUrl,
      promoTag: products.promoTag,
      suggestedPrice: products.suggestedPrice,
      suggestedPricePix: products.suggestedPricePix,
      suggestedPriceCard: products.suggestedPriceCard,
      suggestedPriceBoleto: products.suggestedPriceBoleto,
      stockQuantity: products.stockQuantity,
      minimumStock: products.minimumStock,
      paymentPlatform: products.paymentPlatform,
      pixKey: products.pixKey,
      pixLink: products.pixLink,
      cardPaymentUrl: products.cardPaymentUrl,
      boletoUrl: products.boletoUrl,
      cardInstallments: products.cardInstallments,
      boletoMonths: products.boletoMonths,
    })
    .from(products)
    .where(
      category
        ? and(eq(products.published, true), eq(products.active, true), eq(products.category, category as any))
        : and(eq(products.published, true), eq(products.active, true))
    )
    .orderBy(asc(products.displayOrder), desc(products.createdAt));
}

export async function getPublishedProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      categoryLabel: products.categoryLabel,
      shortDescription: products.shortDescription,
      description: products.description,
      imageUrl: products.imageUrl,
      promoTag: products.promoTag,
      suggestedPrice: products.suggestedPrice,
      suggestedPricePix: products.suggestedPricePix,
      suggestedPriceCard: products.suggestedPriceCard,
      suggestedPriceBoleto: products.suggestedPriceBoleto,
      stockQuantity: products.stockQuantity,
      minimumStock: products.minimumStock,
      paymentPlatform: products.paymentPlatform,
      pixKey: products.pixKey,
      pixLink: products.pixLink,
      cardPaymentUrl: products.cardPaymentUrl,
      boletoUrl: products.boletoUrl,
      cardInstallments: products.cardInstallments,
      boletoMonths: products.boletoMonths,
    })
    .from(products)
    .where(and(eq(products.id, id), eq(products.published, true), eq(products.active, true)))
    .limit(1);
  return result[0] ?? null;
}

export async function togglePublished(
  productId: number,
  _userId: number,
  published: boolean,
  promoTag?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(products)
    .set({
      published,
      promoTag: promoTag ?? null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();

  return updated;
}

export async function updateProductImage(
  productId: number,
  _userId: number,
  imageUrl: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(products)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();

  return updated;
}
