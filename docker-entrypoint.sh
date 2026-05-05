#!/bin/sh
set -e

echo "[PermuPay] Iniciando..."
echo "[PermuPay] Aguardando banco de dados..."

# Aguarda o PostgreSQL ficar disponível (máx 60s)
MAX_TRIES=30
TRIES=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -ge $MAX_TRIES ]; then
    echo "[PermuPay] ERRO: Banco não respondeu após ${MAX_TRIES} tentativas. Abortando."
    exit 1
  fi
  echo "[PermuPay] Banco não disponível ainda, aguardando 2s... (tentativa $TRIES/$MAX_TRIES)"
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
    ssl: { rejectUnauthorized: false }
  });
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

echo "[PermuPay] Iniciando servidor de produção..."
exec node dist/index.js
