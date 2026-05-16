#!/usr/bin/env node
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

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
    const client = new Client({ connectionString: DATABASE_URL, ssl: false, connectionTimeoutMillis: 3000 });
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

// ── 2. Criar tabela de controle se não existir ───────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL UNIQUE,
      created_at bigint
    );
  `);

  // ── 3. Ler journal e aplicar migrations pendentes ─────────────────────────
  const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));

  const { rows: applied } = await client.query("SELECT hash FROM drizzle_migrations");
  const appliedSet = new Set(applied.map((r) => r.hash));

  console.log("[migrate] Aplicando migrations...");

  for (const entry of journal.entries) {
    if (appliedSet.has(entry.tag)) {
      console.log(`[migrate] Pulando (já aplicada): ${entry.tag}`);
      continue;
    }

    const sqlPath = join(process.cwd(), "drizzle", `${entry.tag}.sql`);
    let sql;
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch {
      console.log(`[migrate] Arquivo não encontrado, pulando: ${entry.tag}`);
      await client.query(
        "INSERT INTO drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [entry.tag, entry.when]
      );
      continue;
    }

    // Separar por breakpoints
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let success = true;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        // Ignorar erros de "já existe" (tabelas, colunas, índices)
        if (
          err.code === "42701" || // column already exists
          err.code === "42P07" || // relation already exists
          err.code === "42710" || // duplicate_object (index)
          err.message.includes("already exists")
        ) {
          console.log(`[migrate] Aviso (já existe): ${err.message.split("\n")[0]}`);
        } else {
          console.error(`[migrate] Erro em ${entry.tag}: ${err.message}`);
          success = false;
          break;
        }
      }
    }

    if (!success) {
      console.error(`[migrate] Migration ${entry.tag} falhou. Abortando.`);
      await client.release();
      await pool.end();
      process.exit(1);
    }

    await client.query(
      "INSERT INTO drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [entry.tag, entry.when]
    );
    console.log(`[migrate] ✓ ${entry.tag}`);
  }

  console.log("[migrate] Migrations aplicadas com sucesso!");
} catch (err) {
  console.error("[migrate] Erro fatal:", err.message);
  client.release();
  await pool.end();
  process.exit(1);
}

client.release();
await pool.end();
process.exit(0);
