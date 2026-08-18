import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { orders } from "./schema.orders";
import { users } from "./schema";

export const commissionStatusEnum = pgEnum("permupay_commission_status", [
  "PENDENTE",
  "PAGO",
]);

export const sellers = pgTable("permupay_sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
  commissionRate: real("commission_rate").notNull().default(5),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commissions = pgTable("permupay_commissions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  orderTotal: real("order_total").notNull(),
  commissionRate: real("commission_rate").notNull(),
  commissionValue: real("commission_value").notNull(),
  status: commissionStatusEnum("status").notNull().default("PENDENTE"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = typeof sellers.$inferInsert;
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = typeof commissions.$inferInsert;
