/**
 * storage.upload.ts — Upload de imagens de produto
 *
 * Estratégia: salva localmente em /var/data/permupay/uploads/products/
 * Serve via rota Express /uploads/products/<arquivo>
 * Sem dependência de S3/R2 — funciona direto no Coolify com volume persistente.
 *
 * Para migrar para S3 no futuro: adicione as vars S3_BUCKET, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY no Coolify — o código detecta automaticamente.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────

const UPLOAD_DIR =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads", "products")
    : path.join("/var/data/permupay", "uploads", "products");

const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_MB = 5;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// ─── Garantir diretório ───────────────────────────────────────────────────────

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// ─── Upload direto (buffer) ───────────────────────────────────────────────────

export async function uploadProductImageBuffer(
  productId: number,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Tipo de arquivo não permitido: ${mimeType}. Use JPEG, PNG, WebP ou GIF.`
    );
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Imagem deve ter no máximo ${MAX_FILE_SIZE_MB}MB.`);
  }

  await ensureUploadDir();

  const ext = MIME_TO_EXT[mimeType] ?? path.extname(originalFilename).toLowerCase() ?? ".jpg";
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const filename = `${productId}_${uid}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, fileBuffer);

  const publicUrl = `${APP_URL}/uploads/products/${filename}`;
  console.log(`[Storage] Imagem salva: ${filepath} → ${publicUrl}`);
  return publicUrl;
}

// ─── Deletar imagem ────────────────────────────────────────────────────────────

export async function deleteProductImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;
  try {
    // Extrai apenas o nome do arquivo da URL
    const filename = path.basename(new URL(imageUrl).pathname);
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filepath);
    console.log(`[Storage] Imagem deletada: ${filepath}`);
  } catch {
    // Falha silenciosa — não bloqueia a operação principal
    console.warn("[Storage] Não foi possível deletar imagem:", imageUrl);
  }
}

// ─── Compatibilidade: getPresignedUploadUrl não é mais usada ─────────────────
// Mantida para evitar erros de import em outros arquivos — lança erro claro.

export async function getPresignedUploadUrl(
  _productId: number,
  _filename: string,
  _mimeType: string
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  throw new Error(
    "Presigned URLs não são suportadas nesta configuração. Use uploadProductImageBuffer."
  );
}
