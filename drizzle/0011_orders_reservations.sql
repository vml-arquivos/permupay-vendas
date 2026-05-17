-- Enum de status do pedido
CREATE TYPE permupay_order_status AS ENUM (
  'RESERVADO',
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO',
  'EXPIRADO'
);

-- Enum de método de pagamento
CREATE TYPE permupay_payment_method AS ENUM (
  'PIX',
  'CARTAO',
  'BOLETO'
);

-- Tabela de pedidos
CREATE TABLE permupay_orders (
  id                  SERIAL PRIMARY KEY,
  product_id          INTEGER NOT NULL REFERENCES permupay_products(id) ON DELETE RESTRICT,
  quantity            INTEGER NOT NULL DEFAULT 1,

  -- Dados do comprador
  buyer_name          TEXT NOT NULL,
  buyer_contact       TEXT NOT NULL,
  buyer_contact_type  TEXT NOT NULL DEFAULT 'WHATSAPP',

  -- Pagamento
  payment_method      permupay_payment_method NOT NULL,
  unit_price          REAL NOT NULL,
  total_price         REAL NOT NULL,

  -- Status e controle
  status              permupay_order_status NOT NULL DEFAULT 'RESERVADO',
  expires_at          TIMESTAMP NOT NULL,   -- reserva expira em 2h se não confirmada
  confirmed_at        TIMESTAMP,
  confirmed_by        INTEGER REFERENCES permupay_users(id) ON DELETE SET NULL,
  cancelled_at        TIMESTAMP,
  admin_notes         TEXT,

  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index para facilitar busca de reservas expiradas
CREATE INDEX permupay_orders_status_expires ON permupay_orders(status, expires_at);
CREATE INDEX permupay_orders_product_id     ON permupay_orders(product_id);
