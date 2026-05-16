import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("permupay_role", ["user", "admin"]);
export const productCategoryEnum = pgEnum("permupay_product_category", [
  "CELULAR",
  "ELETRONICO",
  "PERFUME",
  "OUTRO",
]);
export const taxRegimeEnum = pgEnum("permupay_tax_regime", [
  "SIMPLES_NACIONAL",
  "LUCRO_PRESUMIDO",
  "LUCRO_REAL",
  "MANUAL",
]);
export const marginModeEnum = pgEnum("permupay_margin_mode", [
  "PERCENT",
  "VALUE",
]);
export const batchStatusEnum = pgEnum("permupay_batch_status", [
  "OPEN",
  "CLOSED",
]);

// ─── Tabela: users ────────────────────────────────────────────────────────────

export const users = pgTable("permupay_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("passwordHash").notNull(),
  role: roleEnum("role").default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── Tabela: products ─────────────────────────────────────────────────────────

export const products = pgTable("permupay_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),

  // Identidade
  name: text("name").notNull(),
  category: productCategoryEnum("category").notNull(),
  ncm: text("ncm"),

  // Custos base
  costPrice: real("cost_price").notNull().default(0),
  packagingCost: real("packaging_cost").notNull().default(0),
  inboundShippingCost: real("inbound_shipping_cost").notNull().default(0),
  operationalCost: real("operational_cost").notNull().default(0),

  // Margem
  desiredMarginRate: real("desired_margin_rate").notNull().default(0),
  desiredMarginValue: real("desired_margin_value").notNull().default(0),
  marginMode: marginModeEnum("margin_mode").notNull().default("PERCENT"),

  // Fiscal
  taxRegime: taxRegimeEnum("tax_regime").notNull().default("SIMPLES_NACIONAL"),
  estimatedTaxRate: real("estimated_tax_rate").notNull().default(0),

  // Moeda / câmbio
  costCurrency: text("cost_currency").default("BRL"),
  costPriceUsd: real("cost_price_usd").notNull().default(0),
  usdExchangeRate: real("usd_exchange_rate").notNull().default(0),
  costPriceBrl: real("cost_price_brl").notNull().default(0),

  // Estoque
  stockQuantity: real("stock_quantity").notNull().default(0),
  minimumStock: real("minimum_stock").notNull().default(0),
  averageCostBrl: real("average_cost_brl").notNull().default(0),
  finalUnitCostBrl: real("final_unit_cost_brl").notNull().default(0),

  // Marketplace
  imageUrl: text("image_url"),
  promoTag: text("promo_tag"),
  published: boolean("published").notNull().default(false),

  notes: text("notes"),

  // Catálogo e vitrine
  shortDescription: text("short_description"),
  description: text("description"),

  // Preços sugeridos calculados (salvos para exibição na vitrine)
  suggestedPrice: real("suggested_price").notNull().default(0),
  suggestedPricePix: real("suggested_price_pix").notNull().default(0),
  suggestedPriceCard: real("suggested_price_card").notNull().default(0),
  suggestedPriceBoleto: real("suggested_price_boleto").notNull().default(0),

  // Links de pagamento externos
  paymentPlatform: text("payment_platform").default("MERCADO_PAGO"),
  pixKey: text("pix_key"),
  pixLink: text("pix_link"),
  cardPaymentUrl: text("card_payment_url"),
  boletoUrl: text("boleto_url"),

  // Label customizável de categoria para filtro
  categoryLabel: text("category_label"),

  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tabela: pricing_batches ──────────────────────────────────────────────────

export const pricingBatches = pgTable("permupay_pricing_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  totalOperationalCost: real("total_operational_cost").notNull().default(0),
  totalCostOfGoods: real("total_cost_of_goods").notNull().default(0),
  status: batchStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tabela: batch_items ──────────────────────────────────────────────────────

export const batchItems = pgTable("permupay_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .notNull()
    .references(() => pricingBatches.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  productName: text("product_name").notNull(),
  unitCostBrl: real("unit_cost_brl").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  totalItemCost: real("total_item_cost").notNull().default(0),
  // Custo operacional rateado proporcionalmente (fórmula de rateio)
  allocatedOperationalCost: real("allocated_operational_cost")
    .notNull()
    .default(0),
  finalUnitCost: real("final_unit_cost").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull().default(0),
  suggestedPrice: real("suggested_price").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tabela: stock_entries ────────────────────────────────────────────────────

export const stockEntries = pgTable("permupay_stock_entries", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").references(() => pricingBatches.id, {
    onDelete: "set null",
  }),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tabela: pricing_simulations ─────────────────────────────────────────────

export const pricingSimulations = pgTable("permupay_pricing_simulations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  name: text("name").notNull(),
  productSnapshot: jsonb("product_snapshot").notNull(),
  taxSnapshot: jsonb("tax_snapshot").notNull(),
  paymentSnapshot: jsonb("payment_snapshot").notNull(),
  resultSnapshot: jsonb("result_snapshot").notNull(),
  bestPaymentMethod: text("best_payment_method").notNull(),
  worstPaymentMethod: text("worst_payment_method").notNull(),
  recommendedPrice: real("recommended_price").notNull(),
  minimumBreakEvenPrice: real("minimum_break_even_price").notNull(),
  promotionFloorPrice: real("promotion_floor_price").notNull(),
  netProfit: real("net_profit").notNull().default(0),
  netMargin: real("net_margin").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull(),
  diagnosis: text("diagnosis").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SafeUser = Omit<User, "passwordHash">;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type PricingBatch = typeof pricingBatches.$inferSelect;
export type InsertPricingBatch = typeof pricingBatches.$inferInsert;

export type BatchItem = typeof batchItems.$inferSelect;
export type InsertBatchItem = typeof batchItems.$inferInsert;

export type StockEntry = typeof stockEntries.$inferSelect;
export type InsertStockEntry = typeof stockEntries.$inferInsert;

export type PricingSimulation = typeof pricingSimulations.$inferSelect;

// ─── Enum: wishlist status ────────────────────────────────────────────────────

export const wishlistStatusEnum = pgEnum("permupay_wishlist_status", [
  "NOVO",
  "VISUALIZADO",
  "CONTATADO",
  "ATENDIDO",
  "FECHADO",
]);

// ─── Tabela: wishlist_requests ────────────────────────────────────────────────

export const wishlistRequests = pgTable("permupay_wishlist_requests", {
  id: serial("id").primaryKey(),

  // Identidade do solicitante
  visitorName: text("visitor_name").notNull(),
  contact: text("contact").notNull(),
  contactType: text("contact_type").notNull().default("WHATSAPP"),

  // O que procura
  category: text("category"),
  brand: text("brand"),
  model: text("model"),
  description: text("description").notNull(),

  // Orçamento
  budgetMin: real("budget_min").notNull().default(0),
  budgetMax: real("budget_max").notNull().default(0),

  // Gestão admin
  status: wishlistStatusEnum("status").notNull().default("NOVO"),
  adminNotes: text("admin_notes"),
  attendedBy: integer("attended_by").references(() => users.id, {
    onDelete: "set null",
  }),

  // Controle
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WishlistRequest = typeof wishlistRequests.$inferSelect;
export type InsertWishlistRequest = typeof wishlistRequests.$inferInsert;
