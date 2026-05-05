CREATE TYPE IF NOT EXISTS "permupay_product_category" AS ENUM ('CELULAR','ELETRONICO','PERFUME','OUTRO');
CREATE TYPE IF NOT EXISTS "permupay_tax_regime" AS ENUM ('SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL','MANUAL');

CREATE TABLE IF NOT EXISTS "permupay_products" (
  "id" serial PRIMARY KEY,
  "user_id" integer,
  "name" text NOT NULL,
  "category" "permupay_product_category" NOT NULL,
  "ncm" text,
  "cost_price" real NOT NULL DEFAULT 0,
  "packaging_cost" real NOT NULL DEFAULT 0,
  "inbound_shipping_cost" real NOT NULL DEFAULT 0,
  "operational_cost" real NOT NULL DEFAULT 0,
  "desired_margin_rate" real NOT NULL DEFAULT 0,
  "tax_regime" "permupay_tax_regime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  "estimated_tax_rate" real NOT NULL DEFAULT 0,
  "notes" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "permupay_pricing_simulations" (
  "id" serial PRIMARY KEY,
  "user_id" integer,
  "product_id" integer,
  "name" text NOT NULL,
  "product_snapshot" jsonb NOT NULL,
  "tax_snapshot" jsonb NOT NULL,
  "payment_snapshot" jsonb NOT NULL,
  "result_snapshot" jsonb NOT NULL,
  "best_payment_method" text NOT NULL,
  "worst_payment_method" text NOT NULL,
  "recommended_price" real NOT NULL,
  "minimum_break_even_price" real NOT NULL,
  "promotion_floor_price" real NOT NULL,
  "desired_margin_rate" real NOT NULL,
  "diagnosis" text NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
