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
  stockQueue,
  type BatchItem,
  type InsertBatchItem,
  type InsertPricingBatch,
  type InsertStockEntry,
  type InsertStockQueue,
  type PricingBatch,
  type StockQueue,
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

  return await baseQuery;
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

// ══════════════════════════════════════════════════════════════════════════════
// SERVIÇO FIFO — Fila de Estoque por Lote
// ══════════════════════════════════════════════════════════════════════════════

/**
 * processBatchFIFO
 *
 * Versão FIFO do processBatch. Para cada item do lote:
 *   1. Calcula o rateio proporcional de custos (mesmo motor que processBatch)
 *   2. Se produto já tem estoque ativo (stockQuantity > 0):
 *      → Insere na fila com status = EM_ESPERA
 *      → O produto ativo NÃO é alterado
 *   3. Se produto tem estoque = 0:
 *      → Entra direto como ATIVO (não há fila para ele)
 *      → Atualiza custo e preço do produto imediatamente
 *
 * Prevenção de concorrência: usa tx.execute com SELECT FOR UPDATE no produto
 * antes de qualquer UPDATE, garantindo leitura não-fantasma em alta carga.
 */
export async function processBatchFIFO(
  batchId: number,
  userId: number,
  items: BatchItemInput[],
  totalOperationalCost: number
): Promise<BatchPricingResult & { queuedCount: number; activatedCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar lote
  const [batch] = await db
    .select()
    .from(pricingBatches)
    .where(eq(pricingBatches.id, batchId))
    .limit(1);

  if (!batch) throw new Error("Lote não encontrado");
  if (batch.status === "CLOSED") throw new Error("Este lote já está fechado");

  // Calcular rateio (motor existente — sem alteração)
  const result = calculateBatchPricing({ items, totalOperationalCost });
  if (isBatchPricingError(result)) throw new Error(result.message);

  // Limpar itens anteriores
  await db.delete(batchItems).where(eq(batchItems.batchId, batchId));

  let queuedCount = 0;
  let activatedCount = 0;

  // Processar cada item dentro de uma transação
  await db.transaction(async (tx) => {
    for (const item of result.items) {
      if (!item.productId) {
        // Produto não vinculado — só salva batch_item sem mexer em estoque
        await tx.insert(batchItems).values({
          batchId,
          productId: null,
          productName: item.productName,
          unitCostBrl: item.unitCostBrl,
          quantity: item.quantity,
          totalItemCost: item.totalItemCost,
          allocatedOperationalCost: item.allocatedOperationalCost,
          finalUnitCost: item.finalUnitCost,
          desiredMarginRate: item.desiredMarginRate,
          suggestedPrice: item.suggestedPrice,
          queueStatus: "EM_ESPERA",
        } as any);
        continue;
      }

      // Leitura com lock exclusivo para evitar race condition
      const [current] = await tx.execute(
        sql`SELECT id, stock_quantity, average_cost_brl, suggested_price_pix,
                   suggested_price_card, suggested_price_boleto
            FROM permupay_products
            WHERE id = ${item.productId}
            FOR UPDATE`
      ) as any;

      if (!current) continue;

      const currentStock = Number(current.stock_quantity ?? 0);

      // Calcular preços sugeridos individuais para este item
      const taxRate = (item.estimatedTaxRate ?? 6) / 100;
      const marginRate = item.desiredMarginRate / 100;
      const divisor = Math.max(0.01, 1 - marginRate - taxRate);
      const prixPix    = parseFloat((item.finalUnitCost / divisor).toFixed(2));
      const priceCard  = parseFloat((prixPix * 1.05).toFixed(2));  // +5% cartão
      const priceBoleto = parseFloat((prixPix * 1.06).toFixed(2)); // +6% boleto

      // Calcular próxima posição na fila para este produto
      const [{ maxPos }] = await tx.execute(
        sql`SELECT COALESCE(MAX(position), -1) AS "maxPos"
            FROM permupay_stock_queue
            WHERE product_id = ${item.productId}
              AND status IN ('EM_ESPERA', 'ATIVO')`
      ) as any;

      const nextPosition = Number(maxPos ?? -1) + 1;

      if (currentStock > 0) {
        // ── PRODUTO TEM ESTOQUE → FILA DE ESPERA ──────────────────────────
        const [queueEntry] = await tx
          .insert(stockQueue)
          .values({
            productId: item.productId,
            batchId,
            userId,
            quantity: item.quantity,
            quantityRemaining: item.quantity,
            unitCost: item.finalUnitCost,
            suggestedPricePix: prixPix,
            suggestedPriceCard: priceCard,
            suggestedPriceBoleto: priceBoleto,
            desiredMarginRate: item.desiredMarginRate,
            estimatedTaxRate: item.estimatedTaxRate ?? 6,
            status: "EM_ESPERA",
            position: nextPosition,
            notes: `Lote #${batchId} — ${item.productName}`,
          } as InsertStockQueue)
          .returning({ id: stockQueue.id });

        // Salvar batch_item com referência à fila
        await tx.insert(batchItems).values({
          batchId,
          productId: item.productId,
          productName: item.productName,
          unitCostBrl: item.unitCostBrl,
          quantity: item.quantity,
          totalItemCost: item.totalItemCost,
          allocatedOperationalCost: item.allocatedOperationalCost,
          finalUnitCost: item.finalUnitCost,
          desiredMarginRate: item.desiredMarginRate,
          suggestedPrice: item.suggestedPrice,
          queueStatus: "EM_ESPERA",
          queueId: queueEntry?.id ?? null,
        } as any);

        // Registrar entrada de estoque como "em espera" (rastreabilidade)
        await tx.insert(stockEntries).values({
          productId: item.productId,
          batchId,
          userId,
          quantity: item.quantity,
          unitCost: item.finalUnitCost,
          notes: `[FILA] Lote #${batchId} posição ${nextPosition} — aguardando estoque ativo zerar`,
        });

        queuedCount++;
      } else {
        // ── PRODUTO SEM ESTOQUE → ENTRA DIRETO COMO ATIVO ─────────────────
        const [queueEntry] = await tx
          .insert(stockQueue)
          .values({
            productId: item.productId,
            batchId,
            userId,
            quantity: item.quantity,
            quantityRemaining: item.quantity,
            unitCost: item.finalUnitCost,
            suggestedPricePix: prixPix,
            suggestedPriceCard: priceCard,
            suggestedPriceBoleto: priceBoleto,
            desiredMarginRate: item.desiredMarginRate,
            estimatedTaxRate: item.estimatedTaxRate ?? 6,
            status: "ATIVO",
            position: nextPosition,
            activatedAt: new Date(),
            notes: `Lote #${batchId} — ativado direto (sem estoque anterior)`,
          } as InsertStockQueue)
          .returning({ id: stockQueue.id });

        await tx.insert(batchItems).values({
          batchId,
          productId: item.productId,
          productName: item.productName,
          unitCostBrl: item.unitCostBrl,
          quantity: item.quantity,
          totalItemCost: item.totalItemCost,
          allocatedOperationalCost: item.allocatedOperationalCost,
          finalUnitCost: item.finalUnitCost,
          desiredMarginRate: item.desiredMarginRate,
          suggestedPrice: item.suggestedPrice,
          queueStatus: "ATIVO",
          queueId: queueEntry?.id ?? null,
        } as any);

        // Atualizar produto com custo e preços do novo lote
        await tx.execute(
          sql`UPDATE permupay_products SET
                stock_quantity        = ${item.quantity},
                average_cost_brl     = ${item.finalUnitCost},
                final_unit_cost_brl  = ${item.finalUnitCost},
                suggested_price_pix  = ${prixPix},
                suggested_price_card = ${priceCard},
                suggested_price_boleto = ${priceBoleto},
                updated_at           = NOW()
              WHERE id = ${item.productId}`
        );

        await tx.insert(stockEntries).values({
          productId: item.productId,
          batchId,
          userId,
          quantity: item.quantity,
          unitCost: item.finalUnitCost,
          notes: `[ATIVO] Lote #${batchId} — ativado imediatamente`,
        });

        activatedCount++;
      }
    }

    // Atualizar totais e marcar lote como FIFO/fechado
    await tx
      .update(pricingBatches)
      .set({
        totalCostOfGoods: result.totalCostOfGoods,
        totalOperationalCost: result.totalOperationalCost,
        fifoMode: true,
        status: "CLOSED",
        updatedAt: new Date(),
      } as any)
      .where(eq(pricingBatches.id, batchId));
  });

  return { ...result, queuedCount, activatedCount };
}

/**
 * triggerStockTransition
 *
 * GATILHO DE VIRADA DE LOTE — chamado sempre que uma venda é registrada.
 *
 * Fluxo:
 *  1. Debita `qtySold` do estoque ativo do produto
 *  2. Se stockQuantity chegou a 0:
 *     a. Marca o lote ATIVO como ESGOTADO na fila
 *     b. Busca o próximo lote EM_ESPERA (menor position, mais antigo)
 *     c. Promove para ATIVO: atualiza produto com novos preços e quantidade
 *  3. Se stockQuantity ainda > 0: só debita, nada mais
 *
 * Retorna informações sobre a transição para o caller logar/notificar.
 */
export async function triggerStockTransition(
  productId: number,
  qtySold: number,
  userId?: number
): Promise<{
  newStock: number;
  transitioned: boolean;
  promotedQueueId?: number;
  newLotName?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // Lock exclusivo no produto para serializar vendas concorrentes
    const [product] = await tx.execute(
      sql`SELECT id, stock_quantity, name
          FROM permupay_products
          WHERE id = ${productId}
          FOR UPDATE`
    ) as any;

    if (!product) throw new Error("Produto não encontrado");

    const currentStock = Number(product.stock_quantity ?? 0);
    const newStock = Math.max(0, currentStock - qtySold);

    // Debitar estoque
    await tx.execute(
      sql`UPDATE permupay_products
          SET stock_quantity = ${newStock}, updated_at = NOW()
          WHERE id = ${productId}`
    );

    if (newStock > 0) {
      // Ainda tem saldo — nenhuma transição necessária
      return { newStock, transitioned: false };
    }

    // ── ESTOQUE ZEROU → INICIAR VIRADA DE LOTE ────────────────────────────

    // 1. Marcar lote ATIVO atual como ESGOTADO
    await tx.execute(
      sql`UPDATE permupay_stock_queue
          SET status = 'ESGOTADO',
              quantity_remaining = 0,
              exhausted_at = NOW(),
              updated_at = NOW()
          WHERE product_id = ${productId}
            AND status = 'ATIVO'`
    );

    // 2. Buscar próximo lote em espera (FIFO: menor position, criado antes)
    const [nextQueue] = await tx.execute(
      sql`SELECT id, quantity, unit_cost,
                 suggested_price_pix, suggested_price_card, suggested_price_boleto,
                 batch_id
          FROM permupay_stock_queue
          WHERE product_id = ${productId}
            AND status = 'EM_ESPERA'
          ORDER BY position ASC, created_at ASC
          LIMIT 1
          FOR UPDATE`
    ) as any;

    if (!nextQueue) {
      // Sem lotes em espera — produto fica com estoque 0
      return { newStock: 0, transitioned: false };
    }

    // 3. Promover para ATIVO
    await tx.execute(
      sql`UPDATE permupay_stock_queue
          SET status = 'ATIVO',
              activated_at = NOW(),
              updated_at = NOW()
          WHERE id = ${nextQueue.id}`
    );

    // 4. Atualizar produto com dados do novo lote
    await tx.execute(
      sql`UPDATE permupay_products SET
            stock_quantity         = ${Number(nextQueue.quantity)},
            average_cost_brl       = ${Number(nextQueue.unit_cost)},
            final_unit_cost_brl    = ${Number(nextQueue.unit_cost)},
            suggested_price_pix    = ${Number(nextQueue.suggested_price_pix)},
            suggested_price_card   = ${Number(nextQueue.suggested_price_card)},
            suggested_price_boleto = ${Number(nextQueue.suggested_price_boleto)},
            updated_at             = NOW()
          WHERE id = ${productId}`
    );

    // 5. Registrar evento de transição como stock_entry
    await tx.insert(stockEntries).values({
      productId,
      batchId: nextQueue.batch_id ?? null,
      userId: userId ?? null,
      quantity: Number(nextQueue.quantity),
      unitCost: Number(nextQueue.unit_cost),
      notes: `[VIRADA FIFO] Lote fila #${nextQueue.id} promovido para ATIVO automaticamente`,
    });

    // 6. Atualizar batch_item correspondente
    await tx.execute(
      sql`UPDATE permupay_batch_items
          SET queue_status = 'ATIVO'
          WHERE queue_id = ${nextQueue.id}`
    );

    // Buscar nome do lote para retorno
    const [batchInfo] = await tx.execute(
      sql`SELECT name FROM permupay_pricing_batches WHERE id = ${nextQueue.batch_id}`
    ) as any;

    return {
      newStock: Number(nextQueue.quantity),
      transitioned: true,
      promotedQueueId: Number(nextQueue.id),
      newLotName: batchInfo?.name,
    };
  });
}

/**
 * getStockQueue — Lista a fila completa de um produto
 */
export async function getStockQueue(productId: number): Promise<StockQueue[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(stockQueue)
    .where(eq(stockQueue.productId, productId))
    .orderBy(asc(stockQueue.position), asc(stockQueue.createdAt));
}

/**
 * getAllQueues — Lista toda a fila FIFO paginada (visão admin)
 */
export async function getAllQueues(status?: string): Promise<StockQueue[]> {
  const db = await getDb();
  if (!db) return [];

  const where = status
    ? and(eq(stockQueue.status, status as any))
    : undefined;

  return db
    .select()
    .from(stockQueue)
    .where(where)
    .orderBy(asc(stockQueue.productId), asc(stockQueue.position))
    .limit(500);
}

/**
 * cancelQueueEntry — Cancela uma entrada na fila (admin)
 */
export async function cancelQueueEntry(queueId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [entry] = await db
    .select()
    .from(stockQueue)
    .where(eq(stockQueue.id, queueId))
    .limit(1);

  if (!entry) throw new Error("Entrada não encontrada na fila");
  if (entry.status === "ATIVO") throw new Error("Não é possível cancelar o lote ATIVO. Faça uma virada manual.");

  await db
    .update(stockQueue)
    .set({ status: "CANCELADO", updatedAt: new Date() } as any)
    .where(eq(stockQueue.id, queueId));
}

/**
 * manualStockSale — Registra venda manual e dispara triggerStockTransition
 * Use para testes ou vendas registradas fora do fluxo de orders
 */
export async function manualStockSale(
  productId: number,
  qtySold: number,
  userId?: number
) {
  return triggerStockTransition(productId, qtySold, userId);
}
