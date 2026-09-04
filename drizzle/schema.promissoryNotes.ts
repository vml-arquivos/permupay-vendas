/**
 * drizzle/schema.promissoryNotes.ts — Schema Drizzle para notas promissórias
 *
 * Uma linha por parcela/nota — sempre vinculada a um pedido (permupay_orders)
 * e, quando disponível, ao cadastro do cliente (permupay_customers), para que
 * as notas geradas fiquem armazenadas na ficha do cliente.
 *
 * Mantido em arquivo separado do schema.ts principal, no mesmo padrão de
 * schema.orders.ts / schema.customers.ts / schema.sellers.ts.
 */

import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { orders } from "./schema.orders";
import { customers } from "./schema.customers";

// Ciclo de vida do documento físico/assinatura. Mantido como texto simples
// (não enum) para permitir novos status no futuro sem migration adicional —
// mesmo padrão já usado em permupay_customers.credit_status.
export const PROMISSORY_NOTE_STATUSES = [
  "GERADA",
  "ENVIADA",
  "ASSINADA_DEVOLVIDA",
  "CANCELADA",
] as const;
export type PromissoryNoteStatus = (typeof PROMISSORY_NOTE_STATUSES)[number];

export const promissoryNotes = pgTable("permupay_promissory_notes", {
  id: serial("id").primaryKey(),

  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),

  // Parcela
  installmentNumber: integer("installment_number").notNull(),
  installmentsTotal: integer("installments_total").notNull(),
  amount: real("amount").notNull(),
  totalObligationAmount: real("total_obligation_amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  issuePlace: text("issue_place").notNull().default("Brasília/DF"),
  paymentPlace: text("payment_place").notNull().default("Brasília/DF"),

  // Beneficiário / credor (snapshot no momento da emissão)
  beneficiaryName: text("beneficiary_name").notNull(),
  beneficiaryDocument: text("beneficiary_document"),
  beneficiaryAddress: text("beneficiary_address"),

  // Emitente / devedor (snapshot no momento da emissão — sempre copiado do
  // cadastro real do cliente, nunca inventado)
  issuerName: text("issuer_name").notNull(),
  issuerDocument: text("issuer_document"),
  issuerAddress: text("issuer_address"),

  productDescription: text("product_description").notNull(),

  status: text("status").notNull().default("GERADA"),
  documentUrl: text("document_url"),
  sentAt: timestamp("sent_at"),
  signedReturnedAt: timestamp("signed_returned_at"),
  cancelledAt: timestamp("cancelled_at"),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PromissoryNote = typeof promissoryNotes.$inferSelect;
export type InsertPromissoryNote = typeof promissoryNotes.$inferInsert;
