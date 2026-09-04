-- ============================================================
-- 0029_customers_kyc_credit.sql
-- Expansão de permupay_customers para suportar:
--   • Dados de documento (CPF, RG, data de nascimento)
--   • Upload de documentação (frente/verso do documento, comprovante
--     de endereço) — necessário para crediário, análise de crédito e
--     emissão de boleto/promissória.
--   • Status de análise de crédito (NAO_ANALISADO / APROVADO / REPROVADO)
--     com limite de crédito, observações e auditoria de quem analisou.
--
-- 100% ADITIVO E IDEMPOTENTE — usa ADD COLUMN IF NOT EXISTS em tudo.
-- Não remove, renomeia nem altera nenhuma coluna existente.
-- ============================================================

ALTER TABLE permupay_customers
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS document_front_url text,
  ADD COLUMN IF NOT EXISTS document_back_url text,
  ADD COLUMN IF NOT EXISTS proof_address_url text,
  ADD COLUMN IF NOT EXISTS credit_status text NOT NULL DEFAULT 'NAO_ANALISADO',
  ADD COLUMN IF NOT EXISTS credit_notes text,
  ADD COLUMN IF NOT EXISTS credit_limit real,
  ADD COLUMN IF NOT EXISTS reviewed_by integer,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp;

-- Índice para busca rápida por CPF (não único de propósito: clientes
-- podem ser cadastrados antes de preencher o CPF, e reaproveitamos o
-- fluxo de identificação por contato já existente).
CREATE INDEX IF NOT EXISTS idx_permupay_customers_cpf
  ON permupay_customers (cpf)
  WHERE cpf IS NOT NULL;
