/**
 * storage.upload.ts — Upload de imagens de produto via S3/R2
 *
 * Substitui/complementa server/storage.ts existente.
 * Expõe dois mecanismos:
 *   1. uploadProductImage(file, productId) — upload direto no servidor (multipart)
 *   2. getPresignedUploadUrl(productId)    — URL pré-assinada para upload direto do browser
 *
 * Configurar variáveis de ambiente:
 *   S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   (Compatível com R2: S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com)
 */

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import path from "node:path";

// ─── Cliente S3 ───────────────────────────────────────────────────────────────

function getS3Client(): S3Client | null {
  const region = process.env.S3_REGION ?? "auto";
  const endpoint = process.env.S3_ENDPOINT; // apenas para R2 / MinIO
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey || !process.env.S3_BUCKET) {
    console.warn("[Storage] S3 não configurado — uploads desabilitados.");
    return null;
  }

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!endpoint, // necessário para R2 / MinIO
  });
}

const BUCKET = process.env.S3_BUCKET ?? "";
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL ?? ""; // ex: https://cdn.example.com

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_MB = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildObjectKey(productId: number, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `products/${productId}/${uid}${ext}`;
}

function buildPublicUrl(key: string): string {
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL}/${key}`;
  return `https://${BUCKET}.s3.amazonaws.com/${key}`;
}

// ─── Upload direto (buffer) ───────────────────────────────────────────────────

export async function uploadProductImageBuffer(
  productId: number,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  const s3 = getS3Client();
  if (!s3) throw new Error("Armazenamento de imagens não configurado no servidor.");

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Tipo de arquivo não permitido: ${mimeType}. Use JPEG, PNG, WebP ou GIF.`
    );
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Imagem deve ter no máximo ${MAX_FILE_SIZE_MB}MB.`);
  }

  const key = buildObjectKey(productId, originalFilename);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000", // 1 ano de cache
      Metadata: {
        productId: String(productId),
      },
    })
  );

  return buildPublicUrl(key);
}

// ─── URL pré-assinada (upload direto do browser) ───────────────────────────────

export async function getPresignedUploadUrl(
  productId: number,
  filename: string,
  mimeType: string,
  expiresInSeconds = 300 // 5 minutos
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const s3 = getS3Client();
  if (!s3) throw new Error("Armazenamento de imagens não configurado no servidor.");

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Tipo de arquivo não permitido: ${mimeType}.`);
  }

  const key = buildObjectKey(productId, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    publicUrl: buildPublicUrl(key),
    key,
  };
}

// ─── Deletar imagem ────────────────────────────────────────────────────────────

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const s3 = getS3Client();
  if (!s3 || !imageUrl) return;

  try {
    // Extrair key da URL
    const url = new URL(imageUrl);
    const key = url.pathname.replace(/^\//, "");
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Falha silenciosa — não bloqueia a operação principal
    console.warn("[Storage] Não foi possível deletar imagem:", imageUrl);
  }
}
