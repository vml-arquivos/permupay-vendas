-- Migration 0025: vendedores externos, atribuição de pedidos e comissões

DO $$
BEGIN
  CREATE TYPE permupay_commission_status AS ENUM ('PENDENTE', 'PAGO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS permupay_sellers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES permupay_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email VARCHAR(320),
  phone VARCHAR(40),
  referral_code VARCHAR(32) NOT NULL UNIQUE,
  commission_rate REAL NOT NULL DEFAULT 5.0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE permupay_orders
  ADD COLUMN IF NOT EXISTS seller_id INTEGER,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_orders_seller_id_fkey'
  ) THEN
    ALTER TABLE permupay_orders
      ADD CONSTRAINT permupay_orders_seller_id_fkey
      FOREIGN KEY (seller_id) REFERENCES permupay_sellers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS permupay_orders_seller_id_idx
  ON permupay_orders(seller_id);
CREATE INDEX IF NOT EXISTS permupay_orders_referral_code_idx
  ON permupay_orders(referral_code);

CREATE TABLE IF NOT EXISTS permupay_commissions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES permupay_orders(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES permupay_sellers(id) ON DELETE CASCADE,
  order_total REAL NOT NULL,
  commission_rate REAL NOT NULL,
  commission_value REAL NOT NULL,
  status permupay_commission_status NOT NULL DEFAULT 'PENDENTE',
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS permupay_commissions_order_id_uq
  ON permupay_commissions(order_id);
CREATE INDEX IF NOT EXISTS permupay_commissions_seller_id_idx
  ON permupay_commissions(seller_id);
CREATE INDEX IF NOT EXISTS permupay_commissions_status_idx
  ON permupay_commissions(status);
