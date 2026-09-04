-- ============================================================
-- 0030_promissory_notes.sql
-- Gerador de notas promissórias + reconfiguração do comprovante.
--
-- 1) permupay_orders.installments — número de parcelas efetivamente
--    praticado no pedido (hoje só existia no produto, como um "padrão");
--    passamos a gravar o valor real usado na venda, para nunca depender
--    de um valor de produto que pode mudar depois da compra.
--
-- 2) permupay_promissory_notes — uma linha por parcela/nota promissória,
--    sempre vinculada a um pedido e a um cliente. Guarda os dados
--    concretos (nome/CPF do emitente, valor, vencimento, texto da
--    obrigação) usados para gerar o PDF, e o ciclo de vida do documento
--    (gerada → enviada → assinada/devolvida) para controlar quando os
--    boletos bancários de pagamento podem ser liberados.
--
-- 3) permupay_payment_settings — dados do beneficiário/credor (razão
--    social, CNPJ/CPF, endereço, praça de pagamento) usados para montar
--    a nota promissória e o comprovante. Continuam sendo a única fonte
--    de verdade para configurações globais de pagamento.
--
-- 100% ADITIVO E IDEMPOTENTE — usa CREATE TABLE/ADD COLUMN IF NOT EXISTS
-- em tudo. Não remove, renomeia nem altera nenhuma coluna existente.
-- ============================================================

ALTER TABLE permupay_orders
  ADD COLUMN IF NOT EXISTS installments integer;

ALTER TABLE permupay_payment_settings
  ADD COLUMN IF NOT EXISTS beneficiary_name text NOT NULL DEFAULT 'Shoop PermuPay',
  ADD COLUMN IF NOT EXISTS beneficiary_document text,
  ADD COLUMN IF NOT EXISTS beneficiary_address text,
  ADD COLUMN IF NOT EXISTS payment_place text NOT NULL DEFAULT 'Brasília/DF',
  ADD COLUMN IF NOT EXISTS boleto_first_due_days integer NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS permupay_promissory_notes (
  id serial PRIMARY KEY,

  -- Origem: sempre presa a um pedido e a um cliente (o "reconhecimento de
  -- dívida" da nota é referente exatamente a essa compra).
  order_id integer NOT NULL REFERENCES permupay_orders(id) ON DELETE CASCADE,
  customer_id integer REFERENCES permupay_customers(id) ON DELETE SET NULL,

  -- Parcela
  installment_number integer NOT NULL,
  installments_total integer NOT NULL,
  amount real NOT NULL,
  total_obligation_amount real NOT NULL,
  due_date timestamp NOT NULL,
  issue_date timestamp NOT NULL DEFAULT NOW(),
  issue_place text NOT NULL DEFAULT 'Brasília/DF',
  payment_place text NOT NULL DEFAULT 'Brasília/DF',

  -- Beneficiário / credor (snapshot no momento da emissão)
  beneficiary_name text NOT NULL,
  beneficiary_document text,
  beneficiary_address text,

  -- Emitente / devedor (snapshot no momento da emissão — nunca inventado,
  -- sempre copiado do cadastro real do cliente na hora de gerar a nota)
  issuer_name text NOT NULL,
  issuer_document text,
  issuer_address text,

  -- Descrição do que gerou a dívida (produto(s)/pedido)
  product_description text NOT NULL,

  -- Ciclo de vida do documento físico/assinatura
  status text NOT NULL DEFAULT 'GERADA',
  document_url text,
  sent_at timestamp,
  signed_returned_at timestamp,
  cancelled_at timestamp,
  notes text,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_permupay_promissory_notes_order_installment
    UNIQUE (order_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_permupay_promissory_notes_order
  ON permupay_promissory_notes (order_id);
CREATE INDEX IF NOT EXISTS idx_permupay_promissory_notes_customer
  ON permupay_promissory_notes (customer_id);
