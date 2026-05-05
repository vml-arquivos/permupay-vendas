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

export const roleEnum = pgEnum("permupay_role", ["user", "admin"]);
export const productCategoryEnum = pgEnum("permupay_product_category", ["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"]);
export const taxRegimeEnum = pgEnum("permupay_tax_regime", ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MANUAL"]);

export const users = pgTable("permupay_users", {
  id: serial("id").primaryKey(), email: varchar("email", { length: 320 }).notNull().unique(), name: text("name").notNull(),
  passwordHash: text("passwordHash").notNull(), role: roleEnum("role").default("user").notNull(), active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const products = pgTable("permupay_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(), category: productCategoryEnum("category").notNull(), ncm: text("ncm"),
  costPrice: real("cost_price").notNull().default(0), packagingCost: real("packaging_cost").notNull().default(0), inboundShippingCost: real("inbound_shipping_cost").notNull().default(0), operationalCost: real("operational_cost").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull().default(0), taxRegime: taxRegimeEnum("tax_regime").notNull().default("SIMPLES_NACIONAL"), estimatedTaxRate: real("estimated_tax_rate").notNull().default(0),
  notes: text("notes"), active: boolean("active").notNull().default(true), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pricingSimulations = pgTable("permupay_pricing_simulations", {
  id: serial("id").primaryKey(), userId: integer("user_id").references(() => users.id), productId: integer("product_id").references(() => products.id),
  name: text("name").notNull(), productSnapshot: jsonb("product_snapshot").notNull(), taxSnapshot: jsonb("tax_snapshot").notNull(), paymentSnapshot: jsonb("payment_snapshot").notNull(), resultSnapshot: jsonb("result_snapshot").notNull(),
  bestPaymentMethod: text("best_payment_method").notNull(), worstPaymentMethod: text("worst_payment_method").notNull(), recommendedPrice: real("recommended_price").notNull(), minimumBreakEvenPrice: real("minimum_break_even_price").notNull(), promotionFloorPrice: real("promotion_floor_price").notNull(), desiredMarginRate: real("desired_margin_rate").notNull(), diagnosis: text("diagnosis").notNull(), notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SafeUser = Omit<User, "passwordHash">;
