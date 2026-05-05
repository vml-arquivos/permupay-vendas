-- Idempotent and safe migration for shared Postgres database
-- Creates only permupay pricing tables and indexes in public schema

CREATE TABLE IF NOT EXISTS public.permupay_products (
  id serial PRIMARY KEY,
  user_id integer,
  name text NOT NULL,
  category public.permupay_product_category NOT NULL,
  ncm text,
  cost_price real NOT NULL DEFAULT 0,
  packaging_cost real NOT NULL DEFAULT 0,
  inbound_shipping_cost real NOT NULL DEFAULT 0,
  operational_cost real NOT NULL DEFAULT 0,
  desired_margin_rate real NOT NULL DEFAULT 0,
  tax_regime public.permupay_tax_regime NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  estimated_tax_rate real NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permupay_pricing_simulations (
  id serial PRIMARY KEY,
  user_id integer,
  product_id integer,
  name text NOT NULL,
  product_snapshot jsonb NOT NULL,
  tax_snapshot jsonb NOT NULL,
  payment_snapshot jsonb NOT NULL,
  result_snapshot jsonb NOT NULL,
  best_payment_method text NOT NULL,
  worst_payment_method text NOT NULL,
  recommended_price real NOT NULL,
  minimum_break_even_price real NOT NULL,
  promotion_floor_price real NOT NULL,
  desired_margin_rate real NOT NULL,
  diagnosis text NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS permupay_products_user_id_idx ON public.permupay_products (user_id);
CREATE INDEX IF NOT EXISTS permupay_products_active_idx ON public.permupay_products (active);
CREATE INDEX IF NOT EXISTS permupay_products_created_at_idx ON public.permupay_products (created_at DESC);

CREATE INDEX IF NOT EXISTS permupay_pricing_simulations_user_id_idx ON public.permupay_pricing_simulations (user_id);
CREATE INDEX IF NOT EXISTS permupay_pricing_simulations_product_id_idx ON public.permupay_pricing_simulations (product_id);
CREATE INDEX IF NOT EXISTS permupay_pricing_simulations_created_at_idx ON public.permupay_pricing_simulations (created_at DESC);

-- Foreign keys applied only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_products_user_id_permupay_users_id_fk'
  ) THEN
    ALTER TABLE public.permupay_products
      ADD CONSTRAINT permupay_products_user_id_permupay_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.permupay_users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_pricing_simulations_user_id_permupay_users_id_fk'
  ) THEN
    ALTER TABLE public.permupay_pricing_simulations
      ADD CONSTRAINT permupay_pricing_simulations_user_id_permupay_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.permupay_users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permupay_pricing_simulations_product_id_permupay_products_id_fk'
  ) THEN
    ALTER TABLE public.permupay_pricing_simulations
      ADD CONSTRAINT permupay_pricing_simulations_product_id_permupay_products_id_fk
      FOREIGN KEY (product_id) REFERENCES public.permupay_products(id);
  END IF;
END $$;
