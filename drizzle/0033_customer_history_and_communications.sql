-- Migração 0033: histórico de análise de crédito + trilha de auditoria de
-- envios (WhatsApp/e-mail) por cliente.
--
-- Objetivo: dar suporte à página individual completa do cliente —
-- "análise de crédito com histórico" e "ações de WhatsApp/email com
-- confirmação de envio e trilha de auditoria" precisam de armazenamento
-- próprio, que não existia antes (só o status atual era guardado).
--
-- 100% aditiva: cria duas tabelas novas, não altera nenhuma existente.

CREATE TABLE IF NOT EXISTS permupay_credit_status_history (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES permupay_customers(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  notes text,
  credit_limit real,
  changed_by_user_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_credit_status_history_customer_idx
  ON permupay_credit_status_history (customer_id, created_at DESC);
--> statement-breakpoint

-- Trilha de auditoria de envios ao cliente (comprovante, boleto/nota
-- promissória, cobrança). Registrada no momento em que o atendente aciona o
-- envio pela página do cliente — não substitui uma confirmação de entrega
-- real do provedor (WhatsApp/e-mail), que exigiria integração paga com uma
-- API de terceiros ainda não configurada neste ambiente.
CREATE TABLE IF NOT EXISTS permupay_customer_communications (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES permupay_customers(id) ON DELETE CASCADE,
  order_id integer,
  channel text NOT NULL,
  purpose text NOT NULL,
  target text NOT NULL,
  message_preview text,
  sent_by_user_id integer,
  created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS permupay_customer_communications_customer_idx
  ON permupay_customer_communications (customer_id, created_at DESC);
