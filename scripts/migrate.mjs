#!/usr/bin/env node
/**
 * Script de migração para produção.
 * Aguarda o banco ficar disponível e aplica as migrations do Drizzle.
 * Executado pelo docker-entrypoint.sh antes de iniciar o servidor.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client, Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] ERRO: DATABASE_URL não definida.");
  process.exit(1);
}

// ── 1. Aguardar o banco ──────────────────────────────────────────────────────
const MAX_TRIES = 60;
let tries = 0;
let connected = false;

console.log("[migrate] Aguardando banco de dados...");
console.log("[migrate] DATABASE_URL:", DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));

while (!connected && tries < MAX_TRIES) {
  tries++;
  try {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    await client.end();
    connected = true;
    console.log(`[migrate] Banco disponível após ${tries} tentativa(s).`);
  } catch (err) {
    console.log(`[migrate] Tentativa ${tries}/${MAX_TRIES} — ${err.message}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

if (!connected) {
  console.error("[migrate] ERRO: Banco não respondeu. Abortando.");
  process.exit(1);
}

// ── 2. Aplicar migrations ────────────────────────────────────────────────────
console.log("[migrate] Aplicando migrations...");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  connectionTimeoutMillis: 10000,
});

try {
  const db = drizzle(pool);
  // Caminho relativo à raiz do projeto (onde o container roda)
  const migrationsFolder = join(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Migrations aplicadas com sucesso!");
} catch (err) {
  console.error("[migrate] Erro nas migrations:", err.message);
  await pool.end();
  process.exit(1);
}

await pool.end();
process.exit(0);
