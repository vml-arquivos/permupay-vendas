ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "net_profit" real DEFAULT 0 NOT NULL;
ALTER TABLE IF EXISTS "permupay_pricing_simulations" ADD COLUMN IF NOT EXISTS "net_margin" real DEFAULT 0 NOT NULL;
