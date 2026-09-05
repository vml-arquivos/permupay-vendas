-- Migração 0034: métodos de pagamento habilitados na configuração global
--
-- Objetivo: a tela de Configurações de Pagamento (permupay_payment_settings)
-- precisa da mesma noção de "método habilitado" que já existe por produto
-- (migração 0032) — mas aqui como o PADRÃO GLOBAL usado (a) para decidir o
-- valor inicial de produtos novos e (b) para o botão "aplicar a todos os
-- produtos" na própria tela de configurações.
--
-- 100% aditiva e idempotente — segue o mesmo padrão da 0032.

ALTER TABLE permupay_payment_settings ADD COLUMN IF NOT EXISTS pix_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_payment_settings ADD COLUMN IF NOT EXISTS card_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_payment_settings ADD COLUMN IF NOT EXISTS boleto_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE permupay_payment_settings ADD COLUMN IF NOT EXISTS cash_enabled boolean NOT NULL DEFAULT true;
