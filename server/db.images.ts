/**
 * db.images.ts — Funções de banco para Galeria de Imagens de Produtos
 *
 * Suporta até MAX_IMAGES_PER_PRODUCT imagens por produto.
 * A thumbnail é a imagem marcada como is_thumbnail=true.
 * Ao deletar a thumbnail, a próxima imagem (menor sort_order) vira thumbnail automaticamente.
 */

import { and, asc, eq } from "drizzle-orm";
import {
  productImages,
  products,
  type InsertProductImage,
  type ProductImage,
} from "../drizzle/schema";
import { deleteProductImage as deleteFromS3 } from "./storage.upload";
import { getDb } from "./db";

export const MAX_IMAGES_PER_PRODUCT = 4;

// ─── Listar imagens de um produto ─────────────────────────────────────────────

export async function getProductImages(
  productId: number
): Promise<ProductImage[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
}

// ─── Adicionar imagem à galeria ───────────────────────────────────────────────

export async function addProductImage(
  productId: number,
  userId: number,
  data: { url: string; storageKey?: string; altText?: string }
): Promise<ProductImage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar que o produto pertence ao usuário
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  // Verificar limite de imagens
  const existing = await getProductImages(productId);
  if (existing.length >= MAX_IMAGES_PER_PRODUCT) {
    throw new Error(
      `Limite de ${MAX_IMAGES_PER_PRODUCT} imagens por produto atingido.`
    );
  }

  // Primeira imagem vira thumbnail automaticamente
  const isThumbnail = existing.length === 0;
  const sortOrder = existing.length;

  const [inserted] = await db
    .insert(productImages)
    .values({
      productId,
      url: data.url,
      storageKey: data.storageKey ?? null,
      isThumbnail,
      sortOrder,
      altText: data.altText ?? null,
    } satisfies InsertProductImage)
    .returning();

  // Sincronizar imageUrl no produto se for thumbnail
  if (isThumbnail) {
    await db
      .update(products)
      .set({ imageUrl: data.url, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  return inserted!;
}

// ─── Definir thumbnail ────────────────────────────────────────────────────────

export async function setThumbnail(
  imageId: number,
  productId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar ownership
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  // Verificar que a imagem pertence ao produto
  const [image] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!image) throw new Error("Imagem não encontrada");

  // Remover thumbnail anterior
  await db
    .update(productImages)
    .set({ isThumbnail: false })
    .where(eq(productImages.productId, productId));

  // Definir nova thumbnail
  await db
    .update(productImages)
    .set({ isThumbnail: true })
    .where(eq(productImages.id, imageId));

  // Sincronizar imageUrl no produto
  await db
    .update(products)
    .set({ imageUrl: image.url, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ─── Reordenar imagens ────────────────────────────────────────────────────────

export async function reorderProductImages(
  productId: number,
  userId: number,
  orderedIds: number[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar ownership
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  // Atualizar sort_order de cada imagem
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(productImages)
      .set({ sortOrder: i })
      .where(
        and(
          eq(productImages.id, orderedIds[i]!),
          eq(productImages.productId, productId)
        )
      );
  }
}

// ─── Deletar imagem ───────────────────────────────────────────────────────────

export async function deleteProductImageRecord(
  imageId: number,
  productId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar ownership
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  // Buscar imagem
  const [image] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!image) throw new Error("Imagem não encontrada");

  const wasThumbnail = image.isThumbnail;

  // Deletar do banco
  await db
    .delete(productImages)
    .where(eq(productImages.id, imageId));

  // Tentar deletar do S3/R2 (falha silenciosa)
  if (image.storageKey) {
    try {
      await deleteFromS3(image.url);
    } catch {
      // não bloqueia
    }
  }

  // Se era thumbnail, promover a próxima imagem
  if (wasThumbnail) {
    const remaining = await getProductImages(productId);
    if (remaining.length > 0) {
      const next = remaining[0]!;
      await db
        .update(productImages)
        .set({ isThumbnail: true })
        .where(eq(productImages.id, next.id));
      await db
        .update(products)
        .set({ imageUrl: next.url, updatedAt: new Date() })
        .where(eq(products.id, productId));
    } else {
      // Sem imagens restantes — limpar imageUrl do produto
      await db
        .update(products)
        .set({ imageUrl: null, updatedAt: new Date() })
        .where(eq(products.id, productId));
    }
  }
}

// ─── Atualizar alt text ───────────────────────────────────────────────────────

export async function updateImageAltText(
  imageId: number,
  productId: number,
  userId: number,
  altText: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  await db
    .update(productImages)
    .set({ altText })
    .where(
      and(
        eq(productImages.id, imageId),
        eq(productImages.productId, productId)
      )
    );
}
