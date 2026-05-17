/**
 * drizzle/schema.orders.ts
 *
 * ALTERAÇÕES:
 * - Status padrão: AGUARDANDO_PAGAMENTO (pedido gerado sem descontar estoque)
 * - Novo status: LIBERADO_RETIRADA (após confirmação manual do admin)
 * - Remoção do status RESERVADO como padrão (fluxo antigo de reserva 2h)
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
  "AGUARDANDO_PAGAMENTO",   // pedido gerado, aguarda confirmação manual
  "RESERVADO",              // mantido para retrocompatibilidade
  "PAGO",                   // pagamento confirmado pelo admin → estoque debitado
  "LIBERADO_RETIRADA",      // alias semântico de PAGO, exibido ao cliente
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
  // Padrão: AGUARDANDO_PAGAMENTO — estoque NÃO é debitado na criação
  status: orderStatusEnum("status").notNull().default("AGUARDANDO_PAGAMENTO"),

  // expires_at: mantido para compatibilidade, mas não expira automaticamente no novo fluxo
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
