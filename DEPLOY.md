# PermuPay Vendas — Guia de Deploy no Coolify

## URL de Produção
`https://autopay.permupay.com.br`

---

## Variáveis de Ambiente para o Coolify

Cole estas variáveis em **Environment Variables** da aplicação no Coolify:

```env
# ── Banco de Dados (PostgreSQL interno do Coolify) ────────────────────────────
DATABASE_URL=postgres://rifas:Marcelle040410vm@xvglapzakedq4a09xjmplozb:5432/postgres

# ── Autenticação JWT ──────────────────────────────────────────────────────────
JWT_SECRET=fl4iIG18nOPbLUuDm7kiKkv+ms2A+3T4UOGb0LPmAcHSrhbks2KmrlSfUQrt+tMPyNHNUcltLwUEfhU2LDN8LQ==

# ── Aplicação ─────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=PermuPay Vendas

# ── OAuth (Manus Auth — preencha com seus dados do painel Manus) ──────────────
VITE_APP_ID=
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=
OWNER_NAME=PermuPay

# ── APIs Internas Manus (preencha com seus dados do painel Manus) ─────────────
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# ── Analytics (opcional) ──────────────────────────────────────────────────────
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

---

## Passo a Passo no Coolify

### 1. Criar a Aplicação

1. No Coolify, vá em **Projects → New Resource → Application**
2. Selecione **GitHub** como source → repositório `vml-arquivos/permupay-vendas`
3. Branch: `main`
4. Build Pack: **Dockerfile**
5. Dockerfile path: `./Dockerfile`

### 2. Configurar Domínio

1. Em **Domains**, adicione: `https://autopay.permupay.com.br`
2. Ative **Force HTTPS** e **WWW Redirect** se necessário

### 3. Configurar Variáveis de Ambiente

1. Vá em **Environment Variables**
2. Cole todas as variáveis do bloco acima
3. Clique em **Save**

### 4. Configurar Rede (Banco de Dados)

O banco PostgreSQL já está rodando no Coolify com o nome `rifas`.
Certifique-se de que a aplicação e o banco estão **na mesma rede Docker** no Coolify:
- Vá em **Network** da aplicação
- Adicione a mesma rede do banco `rifas`

### 5. Deploy

1. Clique em **Deploy**
2. Acompanhe os logs — o entrypoint irá:
   - Aguardar o banco ficar disponível
   - Aplicar as migrations automaticamente
   - Iniciar o servidor Node.js

### 6. Verificar

Acesse `https://autopay.permupay.com.br` — o sistema deve estar funcionando.

---

## Migrations

As migrations são aplicadas **automaticamente** no boot do container pelo `docker-entrypoint.sh`.

Para aplicar manualmente via terminal do Coolify:
```bash
node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);
migrate(db, { migrationsFolder: './drizzle' }).then(() => { console.log('OK'); pool.end(); });
"
```

---

## SQL da Migration (para referência)

```sql
CREATE TYPE "public"."role" AS ENUM('user', 'admin');

CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "openId" varchar(64) NOT NULL,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "role" "role" DEFAULT 'user' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "lastSignedIn" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
```
