import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import crypto from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serveStatic";

// ─── Dir de upload local ──────────────────────────────────────────────────────
const UPLOAD_DIR =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "uploads", "products")
    : path.join("/var/data/permupay", "uploads", "products");

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ── Garantir diretório de uploads e servir imagens estáticas ──────────────
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  app.use(
    "/uploads/products",
    express.static(UPLOAD_DIR, { maxAge: "365d", immutable: true, fallthrough: false })
  );

  // ── Rota de upload multipart (substitui presigned URL S3) ─────────────────
  app.post("/api/upload/product-image", async (req, res) => {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX_MB = 5;
    const EXT: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };

    try {
      const { default: busboy } = await import("busboy");
      const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_MB * 1024 * 1024 } });

      let savedUrl: string | null = null;
      let uploadError: string | null = null;

      await new Promise<void>((resolve, reject) => {
        bb.on("file", (_field: string, stream: NodeJS.ReadableStream, info: { mimeType: string }) => {
          const { mimeType } = info;
          if (!ALLOWED.includes(mimeType)) {
            uploadError = `Tipo não permitido: ${mimeType}. Use JPEG, PNG, WebP ou GIF.`;
            (stream as any).resume();
            resolve();
            return;
          }
          const ext = EXT[mimeType] ?? ".jpg";
          const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
          const filename = `${uid}${ext}`;
          const filepath = path.join(UPLOAD_DIR, filename);
          const write = createWriteStream(filepath);

          (stream as any).on("limit", () => {
            uploadError = `Arquivo muito grande. Máximo ${MAX_MB}MB.`;
            (stream as any).destroy();
            write.destroy();
            fs.unlink(filepath).catch(() => {});
          });

          stream.pipe(write as any);
          write.on("finish", () => {
            const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
            savedUrl = `${appUrl}/uploads/products/${filename}`;
            resolve();
          });
          write.on("error", reject);
        });
        bb.on("error", reject);
        bb.on("finish", () => resolve());
        req.pipe(bb as any);
      });

      if (uploadError) { res.status(400).json({ error: uploadError }); return; }
      if (!savedUrl) { res.status(400).json({ error: "Nenhum arquivo recebido." }); return; }
      res.json({ url: savedUrl });
    } catch (err: any) {
      console.error("[Upload] Erro:", err);
      res.status(500).json({ error: err.message ?? "Erro interno no upload." });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    const viteDevModulePath = "./viteDev";
    const { setupVite } = await import(viteDevModulePath);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
