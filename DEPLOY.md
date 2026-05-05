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
```

---

## ⚠️ Passo Crítico: Conectar à Rede Docker do Banco

O banco `rifas` roda em uma rede Docker interna do Coolify. O container da aplicação **precisa estar na mesma rede** para que o hostname `xvglapzakedq4a09xjmplozb` seja resolvível.

### Como conectar no Coolify:

1. Abra a aplicação PermuPay no Coolify
2. Vá em **Network** (aba na configuração da aplicação)
3. Em **Connect to other services**, selecione o banco **rifas**
4. Clique em **Save** e depois em **Redeploy**

> Sem isso, o container não consegue alcançar o banco e fica tentando conectar até atingir o timeout.

---

## Passo a Passo Completo no Coolify

### 1. Criar a Aplicação

1. **Projects → New Resource → Application**
2. Source: **GitHub** → `vml-arquivos/permupay-vendas`
3. Branch: `main`
4. Build Pack: **Dockerfile**
5. Dockerfile path: `./Dockerfile`

### 2. Configurar Domínio

1. Em **Domains**: `https://autopay.permupay.com.br`
2. Ative **Force HTTPS**

### 3. Configurar Variáveis de Ambiente

Cole as 5 variáveis do bloco acima em **Environment Variables**.

### 4. ⚠️ Conectar à Rede do Banco (OBRIGATÓRIO)

1. Vá em **Network** da aplicação
2. Em **Connect to other services**, adicione o banco **rifas**
3. Salve

### 5. Deploy

Clique em **Deploy**. O entrypoint irá:
- Aguardar o banco ficar disponível (via `nc`)
- Aplicar as migrations automaticamente
- Iniciar o servidor Node.js

### 6. Primeiro Acesso

Acesse `https://autopay.permupay.com.br` e crie o primeiro usuário.

> **O primeiro usuário cadastrado vira admin automaticamente.**

---

## Diagnóstico de Problemas

### Container não conecta ao banco

Verifique nos logs do Coolify se aparece a linha:
```
[PermuPay] Banco alvo: xvglapzakedq4a09xjmplozb:5432
```

Se o banco não responde, o problema é de rede Docker. Siga o **Passo 4** acima.

### Testar conectividade manualmente (Terminal do Coolify)

No terminal do container da aplicação:
```sh
nc -zv xvglapzakedq4a09xjmplozb 5432
```

Se retornar `Connection refused` ou `Name does not resolve`, a rede não está configurada.

---

## Autenticação

- **Sem OAuth externo** — 100% autossuficiente no Coolify
- **Email + senha + bcrypt + JWT**
- **Primeiro usuário = admin** automático
- Migrations aplicadas automaticamente no boot

---

## Gerar um novo JWT_SECRET

```bash
openssl rand -base64 64
```
