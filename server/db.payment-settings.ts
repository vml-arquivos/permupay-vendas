/**
 * server/db.payment-settings.ts
 *
 * Configurações globais de pagamento — sempre uma única linha (id = 1).
 * Campos: taxas de cartão (débito, crédito à vista, crédito parcelado,
 * parcelas) e desconto para pagamento em dinheiro/PIX.
 *
 * cardAnticipationRate e cardMonthlyRate foram REMOVIDOS desta tela conforme
 * solicitado — continuam existindo nos produtos para compatibilidade.
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { paymentSettings, type PaymentSetting } from "../drizzle/schema";

const DEFAULTS: Omit<PaymentSetting, "id" | "updatedAt"> = {
  cardDebitFee: 1.5,
  cardCreditCashFee: 2.5,
  cardCreditInstallmentFee: 3.5,
  cardInstallments: 6,
  cashDiscountPercent: 0,
};

export async function getPaymentSettings(): Promise<PaymentSetting> {
  const db = await getDb();
  if (!db) return { id: 1, updatedAt: new Date(), ...DEFAULTS };

  const rows = await db.select().from(paymentSettings).where(eq(paymentSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];

  // Primeira inicialização — insere linha padrão
  const [inserted] = await db
    .insert(paymentSettings)
    .values({ id: 1, ...DEFAULTS })
    .returning();
  return inserted;
}

export async function updatePaymentSettings(
  data: Partial<Omit<PaymentSetting, "id" | "updatedAt">>
): Promise<PaymentSetting> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Garante que a linha existe
  await getPaymentSettings();

  const [updated] = await db
    .update(paymentSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paymentSettings.id, 1))
    .returning();

  return updated;
}
