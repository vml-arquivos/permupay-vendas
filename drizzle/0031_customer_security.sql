-- 0031_customer_security.sql
--
-- Segurança da área do cliente + link público de documentos.
-- 100% aditivo: nenhuma coluna existente é alterada ou removida.
--
-- 1) Senha real para a conta do cliente (nullable — clientes já cadastrados
--    antes desta funcionalidade continuam existindo normalmente; eles
--    "ativam" a conta definindo uma senha na primeira vez que usam
--    "Criar conta" com o mesmo contato já cadastrado).
ALTER TABLE permupay_customers
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE permupay_customers
  ADD COLUMN IF NOT EXISTS last_signed_in timestamp;

-- 2) Token de acesso público (não sequencial, não adivinhável) por pedido,
--    usado para o link de documentos enviado ao cliente por WhatsApp/e-mail
--    (comprovante + notas promissórias), sem exigir login para o cliente
--    baixar seus próprios documentos a partir do link que recebeu.
ALTER TABLE permupay_orders
  ADD COLUMN IF NOT EXISTS access_token text;

CREATE UNIQUE INDEX IF NOT EXISTS permupay_orders_access_token_idx
  ON permupay_orders (access_token)
  WHERE access_token IS NOT NULL;
