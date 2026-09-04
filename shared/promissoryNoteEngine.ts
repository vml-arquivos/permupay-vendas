/**
 * shared/promissoryNoteEngine.ts
 *
 * Motor puro (sem I/O) para calcular o parcelamento de uma venda em boleto
 * bancário e gerar os dados de cada nota promissória correspondente — uma
 * nota por parcela, com valor e vencimento sempre calculados a partir dos
 * dados reais da compra (nunca inventados).
 *
 * Regra de arredondamento: a soma das parcelas tem que bater exatamente com
 * o valor total do pedido. Cada parcela recebe o valor arredondado a 2 casas
 * decimais; a ÚLTIMA parcela absorve a diferença de centavos residual do
 * arredondamento das anteriores.
 */

export interface InstallmentScheduleItem {
  installmentNumber: number;
  installmentsTotal: number;
  amount: number;
  dueDate: Date;
}

/**
 * Soma meses a uma data preservando o dia (com clamp para o último dia do
 * mês de destino, quando o mês de destino é mais curto — ex.: 31/01 + 1 mês
 * vira 28/02 ou 29/02). Implementado localmente para não depender de
 * timezone/hora — sempre opera em UTC a partir da data informada.
 */
function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Calcula a primeira data de vencimento a partir da data da compra.
 * Padrão: 30 dias após a compra (configurável via payment settings).
 */
export function computeFirstDueDate(
  purchaseDate: Date,
  firstDueDays: number
): Date {
  const days = Number.isFinite(firstDueDays) && firstDueDays > 0 ? firstDueDays : 30;
  return addDaysUtc(purchaseDate, days);
}

/**
 * Divide um valor total em N parcelas mensais, com vencimentos sequenciais
 * mensais a partir da primeira data de vencimento informada. A soma das
 * parcelas geradas é sempre matematicamente igual ao valor total (com
 * arredondamento de centavos concentrado na última parcela).
 */
export function computeInstallmentSchedule(
  totalAmount: number,
  installments: number,
  firstDueDate: Date
): InstallmentScheduleItem[] {
  const total = Math.round(Number(totalAmount) * 100) / 100;
  const count = Math.max(1, Math.round(Number(installments) || 1));

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Valor total inválido para gerar parcelamento");
  }

  const baseInstallmentCents = Math.floor((total * 100) / count);
  const items: InstallmentScheduleItem[] = [];
  let accumulatedCents = 0;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const cents = isLast
      ? Math.round(total * 100) - accumulatedCents
      : baseInstallmentCents;
    accumulatedCents += cents;

    items.push({
      installmentNumber: i + 1,
      installmentsTotal: count,
      amount: Math.round(cents) / 100,
      dueDate: i === 0 ? firstDueDate : addMonthsUtc(firstDueDate, i),
    });
  }

  return items;
}
