-- ============================================================
-- Migration 0004: Batch Pricing, Stock Entries & Marketplace
-- ============================================================

-- 1. Adicionar imageUrl na tabela de produtos
ALTER TABLE permupay_products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS promo_tag text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

-- 2. Criar tabela de lotes de precificação
CREATE TABLE IF NOT EXISTS permupay_pricing_batches (
  id                    serial PRIMARY KEY,
  user_id               integer REFERENCES permupay_users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  total_operational_cost real NOT NULL DEFAULT 0,
  total_cost_of_goods    real NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'OPEN',   -- OPEN | CLOSED
  created_at            timestamp NOT NULL DEFAULT now(),
  updated_at            timestamp NOT NULL DEFAULT now()
);

-- 3. Criar tabela de itens do lote (produto + custo rateado)
CREATE TABLE IF NOT EXISTS permupay_batch_items (
  id                      serial PRIMARY KEY,
  batch_id                integer NOT NULL REFERENCES permupay_pricing_batches(id) ON DELETE CASCADE,
  product_id              integer REFERENCES permupay_products(id) ON DELETE SET NULL,
  product_name            text NOT NULL,
  unit_cost_brl           real NOT NULL DEFAULT 0,   -- custo unitário em BRL antes do rateio
  quantity                integer NOT NULL DEFAULT 1,
  total_item_cost         real NOT NULL DEFAULT 0,   -- unit_cost_brl * quantity
  allocated_operational_cost real NOT NULL DEFAULT 0, -- custo operacional rateado para este item
  final_unit_cost         real NOT NULL DEFAULT 0,   -- unit_cost_brl + (allocated_operational_cost / quantity)
  desired_margin_rate     real NOT NULL DEFAULT 0,
  suggested_price         real NOT NULL DEFAULT 0,
  created_at              timestamp NOT NULL DEFAULT now()
);

-- 4. Criar tabela de entradas de estoque vinculadas a lotes
CREATE TABLE IF NOT EXISTS permupay_stock_entries (
  id           serial PRIMARY KEY,
  product_id   integer NOT NULL REFERENCES permupay_products(id) ON DELETE CASCADE,
  batch_id     integer REFERENCES permupay_pricing_batches(id) ON DELETE SET NULL,
  user_id      integer REFERENCES permupay_users(id) ON DELETE SET NULL,
  quantity     real NOT NULL,
  unit_cost    real NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamp NOT NULL DEFAULT now()
);

-- 5. Corrigir net_profit e net_margin na tabela de simulações (caso não existam)
ALTER TABLE permupay_pricing_simulations
  ADD COLUMN IF NOT EXISTS net_profit real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_margin real NOT NULL DEFAULT 0;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id    ON permupay_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_product_id  ON permupay_batch_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_product_id ON permupay_stock_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_batch_id  ON permupay_stock_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_published      ON permupay_products(published) WHERE published = true;
