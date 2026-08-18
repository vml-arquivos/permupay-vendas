/**
 * drizzle/schema.orders.ts — Schema Drizzle para pedidos
 *
 * Mantido separado do schema.ts principal para facilitar manutenção.
 * Importado por server/db.orders.ts.
 */

import {
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum("permupay_order_status", [
  "AGUARDANDO_PAGAMENTO",
  "RESERVADO",
  "PAGO",
  "CANCELADO",
  "EXPIRADO",
]);

export const paymentMethodEnum = pgEnum("permupay_payment_method", [
  "PIX",
  "DINHEIRO",
  "CARTAO",
  "BOLETO",
]);

// ─── Tabela ───────────────────────────────────────────────────────────────────

export const orders = pgTable("permupay_orders", {
  id: serial("id").primaryKey(),

  // Produto referenciado — mantemos FK sem cascade delete para preservar histórico
  productId: integer("product_id").notNull(),

  // Dados do pedido
  quantity: integer("quantity").notNull().default(1),

  // Atribuição opcional de vendas externas
  sellerId: integer("seller_id"),
  referralCode: text("referral_code"),

  // Dados do comprador
  buyerName: text("buyer_name").notNull(),
  buyerContact: text("buyer_contact").notNull(),
  buyerContactType: text("buyer_contact_type").notNull().default("WHATSAPP"),

  // Forma de pagamento e valores
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),

  // Ciclo de vida
  status: orderStatusEnum("status").notNull().default("AGUARDANDO_PAGAMENTO"),
  expiresAt: timestamp("expires_at").notNull(),

  // Confirmação manual pelo admin
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),

  // Cancelamento
  cancelledAt: timestamp("cancelled_at"),

  // Notas internas do admin
  adminNotes: text("admin_notes"),

  // Controle
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
