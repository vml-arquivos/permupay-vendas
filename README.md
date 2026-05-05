# PermuPay Vendas — Simulador de Precificação

Sistema de precificação automática para produtos vendidos no Distrito Federal. Calcula o preço ideal de venda por forma de pagamento, considerando custos, impostos, taxas financeiras e margem desejada.

---

## Funcionalidades

- **Simulação completa** por 5 formas de pagamento: Pix, Boleto, Débito, Crédito à Vista e Crédito Parcelado
- **Motor de cálculo isolado** (`shared/pricingCalculator.ts`) com cálculo reverso de margem
- **Campos fiscais editáveis** com alíquotas sugeridas por regime tributário
- **Diagnóstico automático**: APROVADO, ATENÇÃO, RISCO, PREJUÍZO
- **Tabela comparativa** com todos os indicadores financeiros
- **Preço psicológico** sugerido (terminando em ,90)
- **Aviso fiscal** obrigatório em todos os campos tributários

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + TailwindCSS 4 |
| Backend | Node.js + Express + tRPC 11 |
| Banco de Dados | PostgreSQL 14 (Coolify) / MySQL (Manus) |
| ORM | Drizzle ORM |
| Testes | Vitest |
| Build | Vite 7 + esbuild |

---

## Deploy no Coolify

### Pré-requisitos

- Instância do Coolify configurada
- Serviço PostgreSQL 14 criado no Coolify
- Repositório GitHub conectado ao Coolify

### Passo a passo

1. **Criar serviço PostgreSQL 14** no Coolify:
   - Tipo: PostgreSQL
   - Versão: 14
   - Banco: `permupay_vendas`
   - Usuário: `permupay`
   - Anote a connection string gerada

2. **Criar nova aplicação** no Coolify:
   - Tipo: Application
   - Source: GitHub → `vml-arquivos/permupay-vendas`
   - Branch: `main`
   - Build Pack: Dockerfile

3. **Configurar variáveis de ambiente** no Coolify:

```env
DATABASE_URL=postgresql://permupay:SENHA@host:5432/permupay_vendas
JWT_SECRET=<string aleatória longa — use: openssl rand -base64 64>
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=PermuPay Vendas
```

4. **Executar migrations** após o primeiro deploy:
   ```bash
   # No terminal do container no Coolify
   pnpm drizzle-kit migrate
   ```

5. **Fazer deploy** e acessar a URL gerada pelo Coolify.

---

## Desenvolvimento Local

### Com Docker Compose

```bash
# Clone o repositório
git clone https://github.com/vml-arquivos/permupay-vendas.git
cd permupay-vendas

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# Inicie os serviços
docker compose up -d

# Acesse em http://localhost:3000
```

### Sem Docker

```bash
# Instale as dependências
pnpm install

# Configure o banco de dados PostgreSQL 14 localmente
# e atualize DATABASE_URL no .env

# Execute as migrations
pnpm drizzle-kit migrate

# Inicie em modo desenvolvimento
pnpm dev
```

---

## Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Iniciar servidor de produção |
| `pnpm test` | Executar testes unitários |
| `pnpm check` | Verificar TypeScript |
| `pnpm db:push` | Gerar e aplicar migrations |

---

## Estrutura do Projeto

```
shared/
  pricingCalculator.ts      ← Motor de cálculo isolado (tipos + funções)
  pricingCalculator.test.ts ← Testes unitários (32 testes)
client/src/
  pages/PricingSimulator.tsx ← Página principal do simulador
  App.tsx                    ← Rotas
drizzle/
  schema.ts                  ← Schema do banco de dados
server/
  routers.ts                 ← Endpoints tRPC
  db.ts                      ← Helpers de banco de dados
Dockerfile                   ← Build para Coolify
docker-compose.yml           ← Desenvolvimento local com PostgreSQL 14
```

---

## Aviso Fiscal

> As alíquotas exibidas são **sugeridas automaticamente** com base no regime tributário selecionado. Confirme NCM, regime tributário, CST/CSOSN e eventual substituição tributária com seu contador antes de usar em operações reais. Este sistema **não realiza cálculo fiscal definitivo por NCM**.

---

## Licença

MIT — PermuPay Vendas © 2025
