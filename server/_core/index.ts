import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serveStatic";
import { expireStaleReservations } from "../db.orders";

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

  const uploadDir = process.env.UPLOAD_DIR ?? "/var/data/permupay/uploads";
  import("node:fs").then(({ default: fs }) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  }).catch(() => {
    const fs = require("node:fs");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  });
  app.use("/uploads", express.static(uploadDir));

  app.post("/api/upload/image",
    (req, res, next) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        (req as any).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", next);
    },
    async (req: any, res: any) => {
      try {
        const { uploadProductImageBuffer } = await import("../storage.upload");
        const productId = Number(req.query.productId) || 0;
        const filename = String(req.query.filename || "image.jpg");
        const mimeType = (req.headers["content-type"] as string)?.split(";")[0] || "image/jpeg";
        const url = await uploadProductImageBuffer(productId, req.rawBody, filename, mimeType);
        res.json({ url });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

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

  // Job: expirar reservas vencidas a cada 10 minutos
  setInterval(async () => {
    try {
      const count = await expireStaleReservations();
      if (count > 0) console.log(`[job] ${count} reserva(s) expirada(s)`);
    } catch (err) {
      console.error("[job] Erro ao expirar reservas:", err);
    }
  }, 10 * 60 * 1000);
}

startServer().catch(console.error);
