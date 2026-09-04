-- ============================================================
-- 0013_payment_settings_expansion.sql
-- Expansão de permupay_payment_settings:
--   • Campos Fiscais: tax_regime, tax_boleto, tax_debit, tax_credit_cash, tax_credit_installment
--   • Campos de Cartão: card_anticipation_rate, card_monthly_rate, card_customer_pays_interest
--   • Campos de Boleto: boleto_months, boleto_monthly_rate, boleto_fixed_fee,
--                       boleto_default_risk, boleto_customer_pays_interest
--   • Descontos Universais: discount_pix, discount_cash, discount_boleto,
--                           discount_debit, discount_credit
--
-- IDEM-POTENTE: usa ADD COLUMN IF NOT EXISTS — seguro para re-executar.
-- PIX fiscal = ZERO forçado em código; não há coluna tax_cash aqui.
-- ============================================================

-- Correção de bug pré-existente: nenhuma migration anterior criava a tabela
-- permupay_payment_settings (ela só existia em ambientes onde foi criada por
-- fora, via `drizzle-kit push`). Instalações novas do zero quebravam aqui.
-- Guard idempotente — não afeta ambientes onde a tabela já existe. Bloco
-- copiado literalmente de 0015_recovery_payment_settings.sql (fix já
-- validado anteriormente) para que uma base 100% nova também funcione,
-- já que 0013 roda antes de 0015 na sequência do migrate.mjs.
CREATE TABLE IF NOT EXISTS permupay_payment_settings (
  id                           serial PRIMARY KEY,
  card_debit_fee               real NOT NULL DEFAULT 1.5,
  card_credit_cash_fee         real NOT NULL DEFAULT 2.5,
  card_credit_installment_fee  real NOT NULL DEFAULT 3.5,
  card_installments            integer NOT NULL DEFAULT 6,
  cash_discount_percent        real NOT NULL DEFAULT 0,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS card_debit_fee real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS card_credit_cash_fee real NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS card_credit_installment_fee real NOT NULL DEFAULT 3.5,
  ADD COLUMN IF NOT EXISTS card_installments real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS cash_discount_percent real NOT NULL DEFAULT 0;

-- Fiscal
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS tax_regime text NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  ADD COLUMN IF NOT EXISTS tax_boleto real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_debit real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_cash real NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tax_credit_installment real NOT NULL DEFAULT 6;

-- Cartão extra
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS card_anticipation_rate real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS card_monthly_rate real NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS card_customer_pays_interest boolean NOT NULL DEFAULT false;

-- Boleto
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS boleto_months real NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS boleto_monthly_rate real NOT NULL DEFAULT 1.99,
  ADD COLUMN IF NOT EXISTS boleto_fixed_fee real NOT NULL DEFAULT 3.50,
  ADD COLUMN IF NOT EXISTS boleto_default_risk real NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS boleto_customer_pays_interest boolean NOT NULL DEFAULT false;

-- Descontos universais
ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS discount_pix real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cash real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_boleto real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_debit real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_credit real NOT NULL DEFAULT 0;

-- Garante que a linha padrão id=1 existe com todos os novos campos
INSERT INTO permupay_payment_settings (
  id,
  tax_regime, tax_boleto, tax_debit, tax_credit_cash, tax_credit_installment,
  card_debit_fee, card_credit_cash_fee, card_credit_installment_fee, card_installments,
  card_anticipation_rate, card_monthly_rate, card_customer_pays_interest,
  boleto_months, boleto_monthly_rate, boleto_fixed_fee, boleto_default_risk, boleto_customer_pays_interest,
  discount_pix, discount_cash, discount_boleto, discount_debit, discount_credit,
  cash_discount_percent,
  updated_at
)
VALUES (
  1,
  'SIMPLES_NACIONAL', 6, 6, 6, 6,
  1.5, 2.5, 3.5, 6,
  1.5, 1.99, false,
  3, 1.99, 3.50, 2, false,
  0, 0, 0, 0, 0,
  0,
  now()
)
ON CONFLICT (id) DO NOTHING;
