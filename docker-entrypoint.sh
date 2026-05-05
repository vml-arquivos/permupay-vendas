#!/bin/sh
set -e

echo "[PermuPay] ============================================"
echo "[PermuPay] Iniciando PermuPay Vendas..."
echo "[PermuPay] NODE_ENV=${NODE_ENV}"
echo "[PermuPay] PORT=${PORT}"
echo "[PermuPay] ============================================"

# Executa o script ESM de migrations (aguarda banco + aplica migrations)
node scripts/migrate.mjs

echo "[PermuPay] Iniciando servidor de produção na porta ${PORT}..."
exec node dist/index.js
