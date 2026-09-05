/**
 * server/db.payment-settings.ts
 *
 * Configurações globais de pagamento — sempre uma única linha (id = 1).
 *
 * Esta tabela é a FONTE ÚNICA DE VERDADE para:
 *   - taxas fiscais (boleto, débito, crédito à vista, crédito parcelado)
 *   - configuração de cartão (taxas, parcelas, antecipação, juros)
 *   - configuração de boleto (parcelas, juros, taxa fixa, risco)
 *   - descontos universais por forma de pagamento
 *   - links e plataforma de pagamento globais (defaults para novos produtos)
 *
 * PIX é sempre isento de imposto (taxCash = 0 forçado no código).
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { paymentSettings, products, type PaymentSetting } from "../drizzle/schema";

const DEFAULTS: Omit<PaymentSetting, "id" | "updatedAt"> = {
  // Fiscal
  taxRegime: "SIMPLES_NACIONAL",
  taxBoleto: 6,
  taxDebit: 6,
  taxCreditCash: 6,
  taxCreditInstallment: 6,
  // Cartão
  cardDebitFee: 1.5,
  cardCreditCashFee: 2.5,
  cardCreditInstallmentFee: 3.5,
  cardInstallments: 6,
  cardAnticipationRate: 1.5,
  cardMonthlyRate: 1.99,
  cardCustomerPaysInterest: false,
  // Boleto
  boletoMonths: 3,
  boletoMonthlyRate: 1.99,
  boletoFixedFee: 3.50,
  boletoDefaultRisk: 2,
  boletoCustomerPaysInterest: false,
  // Descontos universais
  discountPix: 0,
  discountCash: 0,
  discountBoleto: 0,
  discountDebit: 0,
  discountCredit: 0,
  // Legado
  cashDiscountPercent: 0,
  // Links e plataforma globais
  paymentPlatform: "MERCADO_PAGO",
  pixKey: null,
  pixLink: null,
  cardPaymentUrl: null,
  boletoUrl: null,
  // Métodos de pagamento habilitados (padrão global)
  pixEnabled: true,
  cardEnabled: true,
  boletoEnabled: true,
  cashEnabled: true,
  // Beneficiário / credor — usado na nota promissória e no comprovante
  beneficiaryName: "Shoop PermuPay",
  beneficiaryDocument: null,
  beneficiaryAddress: null,
  paymentPlace: "Brasília/DF",
  boletoFirstDueDays: 30,
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

/**
 * "Aplicar a todos os produtos" — sobrescreve pixEnabled/cardEnabled/
 * boletoEnabled/cashEnabled de TODOS os produtos com os valores atuais da
 * configuração global. É uma ação explícita e em massa (o usuário aciona um
 * botão dedicado na tela de Configurações de Pagamento) — nunca acontece
 * sozinha ao salvar a configuração global, para não sobrescrever produtos já
 * configurados individualmente sem o usuário pedir.
 *
 * Retorna quantos produtos foram atualizados, para a UI confirmar a ação.
 */
export async function applyPaymentMethodsToAllProducts(): Promise<{
  updatedCount: number;
  settings: Pick<PaymentSetting, "pixEnabled" | "cardEnabled" | "boletoEnabled" | "cashEnabled">;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const settings = await getPaymentSettings();

  const updated = await db
    .update(products)
    .set({
      pixEnabled: settings.pixEnabled,
      cardEnabled: settings.cardEnabled,
      boletoEnabled: settings.boletoEnabled,
      cashEnabled: settings.cashEnabled,
      updatedAt: new Date(),
    })
    .returning({ id: products.id });

  return {
    updatedCount: updated.length,
    settings: {
      pixEnabled: settings.pixEnabled,
      cardEnabled: settings.cardEnabled,
      boletoEnabled: settings.boletoEnabled,
      cashEnabled: settings.cashEnabled,
    },
  };
}
