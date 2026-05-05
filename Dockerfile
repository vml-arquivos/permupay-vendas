# ─── PermuPay Vendas — Dockerfile para Coolify ───────────────────────────────
# Multi-stage build: build + runtime mínimo
# Banco de dados: PostgreSQL 14 (configurar como serviço separado no Coolify)

# ── Estágio 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código-fonte
COPY . .

# Build de produção
RUN pnpm build

# ── Estágio 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm@10.4.1

# Copiar apenas o necessário para produção
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod

# Copiar build gerado
COPY --from=builder /app/dist ./dist

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão (sobrescreva no Coolify)
ENV NODE_ENV=production
ENV PORT=3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Iniciar servidor
CMD ["node", "dist/index.js"]
