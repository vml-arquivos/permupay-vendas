#!/bin/sh
set -e

echo "[PermuPay] ============================================"
echo "[PermuPay] Iniciando PermuPay Vendas..."
echo "[PermuPay] NODE_ENV=${NODE_ENV}"
echo "[PermuPay] PORT=${PORT}"

# Extrair host e porta do DATABASE_URL para diagnóstico
DB_HOST=$(echo "${DATABASE_URL}" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "${DATABASE_URL}" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT=${DB_PORT:-5432}

echo "[PermuPay] Banco alvo: ${DB_HOST}:${DB_PORT}"
echo "[PermuPay] ============================================"

# Aguarda o PostgreSQL ficar disponível usando nc (netcat) — mais confiável que pg
MAX_TRIES=60
TRIES=0

echo "[PermuPay] Aguardando banco de dados em ${DB_HOST}:${DB_PORT}..."

until nc -z "${DB_HOST}" "${DB_PORT}" 2>/dev/null; do
  TRIES=$((TRIES + 1))
  if [ "${TRIES}" -ge "${MAX_TRIES}" ]; then
    echo "[PermuPay] ERRO: Banco ${DB_HOST}:${DB_PORT} não respondeu após ${MAX_TRIES} tentativas ($(( MAX_TRIES * 2 ))s)."
    echo "[PermuPay] Verifique se a aplicação está na mesma rede Docker do banco no Coolify."
    exit 1
  fi
  echo "[PermuPay] Aguardando ${DB_HOST}:${DB_PORT}... (${TRIES}/${MAX_TRIES})"
  sleep 2
done

echo "[PermuPay] Banco disponível! Aplicando migrations..."

node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('[PermuPay] Conexão com banco estabelecida.');
    client.release();
  } catch (err) {
    console.error('[PermuPay] Falha ao conectar no banco:', err.message);
    await pool.end();
    process.exit(1);
  }

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('[PermuPay] Migrations aplicadas com sucesso!');
}

run().catch(err => {
  console.error('[PermuPay] Erro nas migrations:', err.message);
  process.exit(1);
});
"

echo "[PermuPay] Iniciando servidor de produção na porta ${PORT}..."
exec node dist/index.js
