-- Migration: 0007_galeria_imagens
-- Cria tabela de galeria de imagens por produto (múltiplas imagens, thumbnail configurável)

CREATE TABLE IF NOT EXISTS permupay_product_images (
  id            serial        PRIMARY KEY,
  product_id    integer       NOT NULL REFERENCES permupay_products(id) ON DELETE CASCADE,
  url           text          NOT NULL,                    -- URL pública no S3/R2
  storage_key   text,                                      -- chave no bucket (para deletar do S3)
  is_thumbnail  boolean       NOT NULL DEFAULT false,      -- imagem principal / capa
  sort_order    integer       NOT NULL DEFAULT 0,          -- ordem de exibição
  alt_text      text,                                      -- texto alternativo (acessibilidade)
  created_at    timestamp     NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON permupay_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_thumbnail  ON permupay_product_images(product_id, is_thumbnail);

-- Garantir que só existe uma thumbnail por produto (trigger)
CREATE OR REPLACE FUNCTION ensure_single_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_thumbnail = true THEN
    UPDATE permupay_product_images
    SET is_thumbnail = false
    WHERE product_id = NEW.product_id
      AND id <> NEW.id
      AND is_thumbnail = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_thumbnail ON permupay_product_images;
CREATE TRIGGER trg_single_thumbnail
  AFTER INSERT OR UPDATE OF is_thumbnail ON permupay_product_images
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_thumbnail();
