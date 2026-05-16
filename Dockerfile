# ─── PermuPay Vendas — Dockerfile para Coolify ───────────────────────────────
# Usa node:22 (Debian) — binários nativos do esbuild/tailwindcss já disponíveis
# Runtime copia node_modules do builder → sem reinstalação, sem timeout

# ── Estágio 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1 --quiet

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar TODAS as dependências (scripts nativos habilitados — esbuild/tailwindcss compilam)
RUN pnpm install --frozen-lockfile

# Copiar código-fonte
COPY . .

# Build de produção (Vite + esbuild)
RUN pnpm build

# ── Estágio 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Instalar wget para healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

# Copiar tudo do builder — node_modules, dist, drizzle, scripts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Copiar entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Expor porta da aplicação
EXPOSE 4000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/var/data/permupay

# Volume persistente para imagens de produto
VOLUME ["/var/data/permupay"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/ || exit 1

# Entrypoint: aplica migrations e inicia o servidor
ENTRYPOINT ["./docker-entrypoint.sh"]
