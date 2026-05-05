# ─── PermuPay Vendas — Dockerfile para Coolify ───────────────────────────────
# Multi-stage build otimizado para produção
# Banco: PostgreSQL (configurado como serviço separado no Coolify)
# URL: autopay.permupay.com.br

# ── Estágio 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1 --quiet

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar TODAS as dependências (incluindo devDependencies para o build)
RUN pnpm install --frozen-lockfile

# Copiar código-fonte
COPY . .

# Build de produção (Vite + esbuild)
RUN pnpm build

# ── Estágio 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1 --quiet

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar build gerado pelo estágio anterior
COPY --from=builder /app/dist ./dist

# Copiar migrations do Drizzle (necessário para o entrypoint aplicar no boot)
COPY --from=builder /app/drizzle ./drizzle

# Copiar scripts de inicialização
COPY --from=builder /app/scripts ./scripts

# Copiar entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Expor porta da aplicação
EXPOSE 4000

# Variáveis de ambiente padrão (sobrescreva no Coolify via Environment Variables)
ENV NODE_ENV=production
ENV PORT=4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/ || exit 1

# Entrypoint: aplica migrations e inicia o servidor
ENTRYPOINT ["./docker-entrypoint.sh"]
