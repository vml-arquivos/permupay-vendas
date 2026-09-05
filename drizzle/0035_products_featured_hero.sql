-- Migração 0035: seleção de produtos para o carrossel principal da vitrine
--
-- Objetivo: o carrossel de destaque da página principal da vitrine
-- (Marketplace.tsx) era 3 imagens estáticas fixas no código, sem relação
-- com o catálogo/estoque real. Esta coluna permite ao admin marcar quais
-- produtos aparecem no carrossel ("Destacar no carrossel da vitrine"); a
-- vitrine usa esses produtos quando existem e cai para uma curadoria
-- automática (calculada a partir do catálogo publicado em estoque) quando
-- nenhum produto está marcado — o carrossel nunca fica com dado estático
-- desatualizado.
--
-- 100% aditiva e idempotente — segue o mesmo padrão da 0032/0034.

ALTER TABLE permupay_products ADD COLUMN IF NOT EXISTS featured_in_hero boolean NOT NULL DEFAULT false;
