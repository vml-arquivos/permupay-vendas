-- Migração 0032: métodos de pagamento habilitáveis por produto
--
-- Objetivo: permitir que cada produto (permupay_products) escolha quais
-- métodos de pagamento ficam disponíveis para ele (Pix / Cartão / Boleto /
-- Dinheiro), tanto na vitrine pública quanto na venda interna (Nova Venda).
--
-- 100% aditiva e idempotente:
--   - Apenas ADD COLUMN IF NOT EXISTS, nenhuma coluna/tabela é removida ou
--     renomeada.
--   - Todas as colunas novas são NOT NULL DEFAULT true, ou seja, todo
--     produto já existente continua aceitando os 4 métodos normalmente
--     (comportamento atual preservado — zero regressão).
--   - Pode ser reaplicada com segurança (IF NOT EXISTS em tudo).

ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS pix_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS card_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS boleto_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS cash_enabled boolean NOT NULL DEFAULT true;
