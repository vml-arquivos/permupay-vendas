# PermuPay Vendas — Guia de Deploy no Coolify

## URL de Produção
`https://autopay.permupay.com.br`

---

## Variáveis de Ambiente para o Coolify

Cole estas variáveis em **Environment Variables** da aplicação no Coolify:

```env
# ── Banco de Dados (PostgreSQL interno do Coolify) ────────────────────────────
DATABASE_URL=postgres://rifas:Marcelle040410vm@xvglapzakedq4a09xjmplozb:5432/postgres

# ── Autenticação JWT (obrigatório — chave secreta para assinar tokens) ─────────
JWT_SECRET=fl4iIG18nOPbLUuDm7kiKkv+ms2A+3T4UOGb0LPmAcHSrhbks2KmrlSfUQrt+tMPyNHNUcltLwUEfhU2LDN8LQ==

# ── Aplicação ─────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=PermuPay Vendas
```

> Apenas 5 variáveis necessárias. Sem OAuth externo, sem APIs de terceiros.

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
2. Ative **Force HTTPS**

### 3. Configurar Variáveis de Ambiente

1. Vá em **Environment Variables**
2. Cole as 5 variáveis do bloco acima
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

### 6. Primeiro Acesso

Acesse `https://autopay.permupay.com.br` e crie o primeiro usuário.

> **O primeiro usuário cadastrado vira admin automaticamente.**

---

## Autenticação

O sistema usa autenticação própria com **email + senha + JWT**.

- **Sem OAuth externo** — nenhuma dependência de serviços de terceiros
- **Sem Manus, Google, GitHub** — 100% autossuficiente no Coolify
- **Primeiro usuário = admin** — cadastre-se na primeira vez para ter acesso total
- **JWT_SECRET** — chave para assinar os tokens de sessão (mude em produção)

---

## Migrations

As migrations são aplicadas **automaticamente** no boot do container pelo `docker-entrypoint.sh`.

### SQL da Migration (para referência)

```sql
CREATE TYPE "public"."role" AS ENUM('user', 'admin');

CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "name" text NOT NULL,
  "passwordHash" text NOT NULL,
  "role" "role" DEFAULT 'user' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "lastSignedIn" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
```

---

## Gerar um novo JWT_SECRET

```bash
openssl rand -base64 64
```
