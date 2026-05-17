/**
 * drizzle/schema.orders.ts
 * Extensão do schema principal — tabela de pedidos/reservas
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
import { products } from "./schema";

export const orderStatusEnum = pgEnum("permupay_order_status", [
  "RESERVADO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO",
  "CANCELADO",
  "EXPIRADO",
]);

export const paymentMethodEnum = pgEnum("permupay_payment_method", [
  "PIX",
  "CARTAO",
  "BOLETO",
]);

export const orders = pgTable("permupay_orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),

  // Dados do comprador
  buyerName: text("buyer_name").notNull(),
  buyerContact: text("buyer_contact").notNull(),
  buyerContactType: text("buyer_contact_type").notNull().default("WHATSAPP"),

  // Pagamento
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),

  // Status e controle
  status: orderStatusEnum("status").notNull().default("RESERVADO"),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  cancelledAt: timestamp("cancelled_at"),
  adminNotes: text("admin_notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
