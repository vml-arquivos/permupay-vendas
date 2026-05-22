-- 0021_quase_zero_products.sql
-- Quase Zero: canal de venda e condição do produto.
-- Seguro para produtos antigos: tudo recebe DEFAULT e não remove dados existentes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_product_sales_channel') THEN
    CREATE TYPE permupay_product_sales_channel AS ENUM ('SHOP', 'QUASE_ZERO', 'BOTH');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permupay_product_condition') THEN
    CREATE TYPE permupay_product_condition AS ENUM ('NEW', 'SEMINOVO', 'USADO', 'MOSTRUARIO', 'OPEN_BOX', 'REEMBALADO');
  END IF;
END $$;

ALTER TABLE permupay_products
  ADD COLUMN IF NOT EXISTS sales_channel permupay_product_sales_channel NOT NULL DEFAULT 'SHOP',
  ADD COLUMN IF NOT EXISTS product_condition permupay_product_condition NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS condition_notes text,
  ADD COLUMN IF NOT EXISTS is_unique_piece boolean NOT NULL DEFAULT false;

-- Backfill explícito para instalações antigas.
UPDATE permupay_products
SET sales_channel = 'SHOP'
WHERE sales_channel IS NULL;

UPDATE permupay_products
SET product_condition = 'NEW'
WHERE product_condition IS NULL;
