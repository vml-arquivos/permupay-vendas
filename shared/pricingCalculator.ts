/**
 * PermuPay Vendas — Motor de Precificação
 *
 * Motor de cálculo isolado para simulação de preços por forma de pagamento.
 * Implementa cálculo reverso de margem, juros compostos e diagnóstico financeiro.
 *
 * AVISO FISCAL: Alíquotas sugeridas. Confirme NCM, regime tributário,
 * CST/CSOSN e eventual substituição tributária com seu contador.
 */

// ─── Tipos e Interfaces ────────────────────────────────────────────────────────

export type ProductCategory = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";

export type TaxRegime =
  | "SIMPLES_NACIONAL"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL"
  | "MANUAL";

export type PaymentMethod =
  | "PIX"
  | "BOLETO"
  | "DEBITO"
  | "CREDITO_A_VISTA"
  | "CREDITO_PARCELADO";

export type DiagnosticStatus = "APROVADO" | "ATENÇÃO" | "RISCO" | "PREJUÍZO";

export interface TaxRates {
  cash: number;        // Pix/à vista
  boleto: number;      // Boleto
  debit: number;       // Débito
  creditCash: number;  // Crédito à vista
  creditInstallment: number; // Crédito parcelado
}

export interface BoletoConfig {
  months: number;
  monthlyInterestRate: number;   // % ao mês
  fixedFee: number;              // Taxa fixa de emissão (R$)
  defaultRiskRate: number;       // Risco de inadimplência %
  customerPaysInterest: boolean; // Juros repassado ao cliente?
}

export interface CardConfig {
  debitFeeRate: number;            // Taxa débito %
  creditCashFeeRate: number;       // Taxa crédito à vista %
  creditInstallmentFeeRate: number;// Taxa crédito parcelado %
  installments: number;            // Número de parcelas
  anticipationRate: number;        // Taxa de antecipação %
  monthlyInterestRate: number;     // Juros mensal parcelamento %
  customerPaysInterest: boolean;   // Juros absorvido pela empresa?
}

export interface PricingInput {
  productName: string;
  category: ProductCategory;
  ncm?: string;
  costPrice: number;
  packagingCost: number;
  inboundShippingCost: number;
  operationalCost: number;
  desiredMarginRate: number; // % ex: 30 = 30%
  taxRegime: TaxRegime;
  taxRates: TaxRates;
  boleto: BoletoConfig;
  card: CardConfig;
}

export interface PaymentResult {
  method: PaymentMethod;
  methodLabel: string;
  suggestedPrice: number;
  installmentValue: number;
  installments: number;
  totalTax: number;
  totalFees: number;
  totalInterest: number;
  netProfit: number;
  realMarginRate: number;   // % real
  markup: number;           // %
  diagnostic: DiagnosticStatus;
  psychologicalPrice: number;
  minPriceNoLoss: number;
  minPriceWithMargin: number;
}

export interface PricingResult {
  input: PricingInput;
  totalCost: number;
  results: PaymentResult[];
  bestMethod: PaymentMethod;
  worstMethod: PaymentMethod;
  promotionMinPrice: number;
  hasUnhealthyProduct: boolean;
  unhealthyAlert?: string;
}

export interface PricingError {
  code: "INVALID_PERCENTAGES" | "NEGATIVE_COST" | "NEGATIVE_MARGIN" | "INVALID_PERIODS" | "CALCULATION_ERROR";
  message: string;
}

// ─── Alíquotas sugeridas por regime tributário ────────────────────────────────

export const SUGGESTED_TAX_RATES: Record<TaxRegime, TaxRates> = {
  SIMPLES_NACIONAL: {
    cash: 6.0,
    boleto: 6.0,
    debit: 6.0,
    creditCash: 6.0,
    creditInstallment: 6.0,
  },
  LUCRO_PRESUMIDO: {
    cash: 11.33,
    boleto: 11.33,
    debit: 11.33,
    creditCash: 11.33,
    creditInstallment: 11.33,
  },
  LUCRO_REAL: {
    cash: 13.25,
    boleto: 13.25,
    debit: 13.25,
    creditCash: 13.25,
    creditInstallment: 13.25,
  },
  MANUAL: {
    cash: 0,
    boleto: 0,
    debit: 0,
    creditCash: 0,
    creditInstallment: 0,
  },
};

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  MANUAL: "Manual",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix / À Vista",
  BOLETO: "Boleto Bancário",
  DEBITO: "Cartão de Débito",
  CREDITO_A_VISTA: "Crédito à Vista",
  CREDITO_PARCELADO: "Crédito Parcelado",
};

// ─── Funções Auxiliares ───────────────────────────────────────────────────────

/**
 * Formata valor como moeda brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata percentual com 2 casas decimais
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Calcula preço psicológico terminando em ,90
 * Sempre retorna o menor valor X,90 que seja >= price
 */
export function psychologicalPrice(price: number): number {
  // Parte inteira do preço
  const whole = Math.floor(price);
  // Candidato: parte inteira + 0,90
  const candidate = whole + 0.90;
  // Se o candidato já cobre o preço, usa ele; senão avança para o próximo
  return candidate >= price ? candidate : candidate + 1;
}

/**
 * Calcula juros compostos
 * valor_final = valor_base * (1 + taxa_mensal/100) ^ periodos
 */
export function compoundInterest(base: number, monthlyRate: number, periods: number): number {
  if (monthlyRate === 0 || periods <= 1) return base;
  return base * Math.pow(1 + monthlyRate / 100, periods);
}

/**
 * Determina diagnóstico com base na margem real e lucro
 *
 * APROVADO  — margem real >= margem desejada (ou >= 10% se desejada não informada)
 * ATENÇÃO  — margem real abaixo da desejada, mas acima de 10%
 * RISCO    — margem real menor que 10% (mas lucro positivo)
 * PREJUÍZO — lucro líquido negativo
 */
export function getDiagnostic(
  realMarginRate: number,
  netProfit: number,
  desiredMarginRate?: number
): DiagnosticStatus {
  if (netProfit < 0) return "PREJUÍZO";
  if (realMarginRate < 10) return "RISCO";
  if (desiredMarginRate !== undefined && realMarginRate < desiredMarginRate) return "ATENÇÃO";
  return "APROVADO";
}

// ─── Validações ───────────────────────────────────────────────────────────────

export function validatePricingInput(input: PricingInput): PricingError | null {
  const totalCost =
    input.costPrice +
    input.packagingCost +
    input.inboundShippingCost +
    input.operationalCost;

  if (totalCost < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "O custo total do produto não pode ser negativo.",
    };
  }

  if (input.costPrice < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "O preço de custo não pode ser negativo.",
    };
  }

  if (input.desiredMarginRate < 0) {
    return {
      code: "NEGATIVE_MARGIN",
      message: "A margem líquida desejada não pode ser negativa.",
    };
  }

  if (input.boleto.months < 1) {
    return {
      code: "INVALID_PERIODS",
      message: "A quantidade de meses do boleto deve ser no mínimo 1.",
    };
  }

  if (input.card.installments < 1) {
    return {
      code: "INVALID_PERIODS",
      message: "O número de parcelas deve ser no mínimo 1.",
    };
  }

  // Validar que nenhuma soma de percentuais variáveis atinge 100%
  const methods: Array<{ method: string; sum: number }> = [
    {
      method: "Pix",
      sum: input.taxRates.cash + input.desiredMarginRate,
    },
    {
      method: "Boleto",
      sum:
        input.taxRates.boleto +
        input.boleto.defaultRiskRate +
        input.desiredMarginRate,
    },
    {
      method: "Débito",
      sum:
        input.taxRates.debit +
        input.card.debitFeeRate +
        input.desiredMarginRate,
    },
    {
      method: "Crédito à Vista",
      sum:
        input.taxRates.creditCash +
        input.card.creditCashFeeRate +
        input.desiredMarginRate,
    },
    {
      method: "Crédito Parcelado",
      sum:
        input.taxRates.creditInstallment +
        input.card.creditInstallmentFeeRate +
        input.card.anticipationRate +
        input.desiredMarginRate,
    },
  ];

  for (const { method, sum } of methods) {
    if (sum >= 100) {
      return {
        code: "INVALID_PERCENTAGES",
        message: `A soma dos percentuais variáveis para "${method}" atingiu ${sum.toFixed(2)}%, o que tornaria o cálculo inviável. Reduza as alíquotas ou a margem desejada.`,
      };
    }
  }

  return null;
}

// ─── Motor de Cálculo Principal ───────────────────────────────────────────────

/**
 * Calcula o preço para Pix / À Vista
 */
function calculatePix(input: PricingInput, totalCost: number): PaymentResult {
  const variableSum =
    (input.taxRates.cash + input.desiredMarginRate) / 100;

  const suggestedPrice = totalCost / (1 - variableSum);
  const totalTax = suggestedPrice * (input.taxRates.cash / 100);
  const netProfit = suggestedPrice - totalCost - totalTax;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - totalCost) / totalCost) * 100;
  const minPriceNoLoss = totalCost / (1 - input.taxRates.cash / 100);
  const minPriceWithMargin = totalCost / (1 - variableSum);

  return {
    method: "PIX",
    methodLabel: PAYMENT_METHOD_LABELS.PIX,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees: 0,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    markup,
    diagnostic: getDiagnostic(realMarginRate, netProfit, input.desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

/**
 * Calcula o preço para Boleto Bancário
 */
function calculateBoleto(input: PricingInput, totalCost: number): PaymentResult {
  const { boleto, taxRates, desiredMarginRate } = input;

  // Custo total incluindo taxa fixa do boleto
  const totalCostWithFee = totalCost + boleto.fixedFee;

  const variableSum =
    (taxRates.boleto + boleto.defaultRiskRate + desiredMarginRate) / 100;

  // Preço base (sem juros)
  const priceBase = totalCostWithFee / (1 - variableSum);

  // Preço final com juros compostos
  let suggestedPrice: number;
  let totalInterest: number;

  if (boleto.customerPaysInterest) {
    // Juros repassado ao cliente: preço base sem juros, cliente paga a mais
    suggestedPrice = priceBase;
    totalInterest = compoundInterest(priceBase, boleto.monthlyInterestRate, boleto.months) - priceBase;
  } else {
    // Juros embutido no preço: empresa absorve os juros
    suggestedPrice = compoundInterest(priceBase, boleto.monthlyInterestRate, boleto.months);
    totalInterest = suggestedPrice - priceBase;
  }

  const totalTax = suggestedPrice * (taxRates.boleto / 100);
  const totalFees = boleto.fixedFee + suggestedPrice * (boleto.defaultRiskRate / 100);
  const netProfit = suggestedPrice - totalCostWithFee - totalTax - (boleto.customerPaysInterest ? 0 : totalInterest);
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - totalCost) / totalCost) * 100;
  const installmentValue = suggestedPrice / boleto.months;
  const minPriceNoLoss = totalCostWithFee / (1 - taxRates.boleto / 100);
  const minPriceWithMargin = totalCostWithFee / (1 - variableSum);

  return {
    method: "BOLETO",
    methodLabel: PAYMENT_METHOD_LABELS.BOLETO,
    suggestedPrice,
    installmentValue,
    installments: boleto.months,
    totalTax,
    totalFees,
    totalInterest,
    netProfit,
    realMarginRate,
    markup,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

/**
 * Calcula o preço para Cartão de Débito
 */
function calculateDebit(input: PricingInput, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  const variableSum =
    (taxRates.debit + card.debitFeeRate + desiredMarginRate) / 100;

  const suggestedPrice = totalCost / (1 - variableSum);
  const totalTax = suggestedPrice * (taxRates.debit / 100);
  const totalFees = suggestedPrice * (card.debitFeeRate / 100);
  const netProfit = suggestedPrice - totalCost - totalTax - totalFees;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - totalCost) / totalCost) * 100;
  const minPriceNoLoss = totalCost / (1 - (taxRates.debit + card.debitFeeRate) / 100);
  const minPriceWithMargin = totalCost / (1 - variableSum);

  return {
    method: "DEBITO",
    methodLabel: PAYMENT_METHOD_LABELS.DEBITO,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    markup,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

/**
 * Calcula o preço para Crédito à Vista
 */
function calculateCreditCash(input: PricingInput, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  const variableSum =
    (taxRates.creditCash + card.creditCashFeeRate + desiredMarginRate) / 100;

  const suggestedPrice = totalCost / (1 - variableSum);
  const totalTax = suggestedPrice * (taxRates.creditCash / 100);
  const totalFees = suggestedPrice * (card.creditCashFeeRate / 100);
  const netProfit = suggestedPrice - totalCost - totalTax - totalFees;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - totalCost) / totalCost) * 100;
  const minPriceNoLoss = totalCost / (1 - (taxRates.creditCash + card.creditCashFeeRate) / 100);
  const minPriceWithMargin = totalCost / (1 - variableSum);

  return {
    method: "CREDITO_A_VISTA",
    methodLabel: PAYMENT_METHOD_LABELS.CREDITO_A_VISTA,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    markup,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

/**
 * Calcula o preço para Crédito Parcelado
 */
function calculateCreditInstallment(input: PricingInput, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  const variableSum =
    (taxRates.creditInstallment +
      card.creditInstallmentFeeRate +
      card.anticipationRate +
      desiredMarginRate) /
    100;

  // Preço base sem juros
  const priceBase = totalCost / (1 - variableSum);

  // Juros compostos para parcelamento
  let suggestedPrice: number;
  let totalInterest: number;

  if (card.customerPaysInterest) {
    // Empresa absorve os juros: preço base, cliente paga parcelas com juros
    suggestedPrice = priceBase;
    totalInterest = compoundInterest(priceBase, card.monthlyInterestRate, card.installments) - priceBase;
  } else {
    // Juros repassado ao cliente: preço total inclui juros
    suggestedPrice = compoundInterest(priceBase, card.monthlyInterestRate, card.installments);
    totalInterest = suggestedPrice - priceBase;
  }

  const totalTax = suggestedPrice * (taxRates.creditInstallment / 100);
  const totalFees =
    suggestedPrice * (card.creditInstallmentFeeRate / 100) +
    suggestedPrice * (card.anticipationRate / 100);
  const netProfit = suggestedPrice - totalCost - totalTax - totalFees - (card.customerPaysInterest ? 0 : totalInterest);
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - totalCost) / totalCost) * 100;
  const installmentValue = suggestedPrice / card.installments;
  const minPriceNoLoss =
    totalCost /
    (1 - (taxRates.creditInstallment + card.creditInstallmentFeeRate + card.anticipationRate) / 100);
  const minPriceWithMargin = totalCost / (1 - variableSum);

  return {
    method: "CREDITO_PARCELADO",
    methodLabel: PAYMENT_METHOD_LABELS.CREDITO_PARCELADO,
    suggestedPrice,
    installmentValue,
    installments: card.installments,
    totalTax,
    totalFees,
    totalInterest,
    netProfit,
    realMarginRate,
    markup,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

// ─── Função Principal ─────────────────────────────────────────────────────────

/**
 * Executa o cálculo completo de precificação para todas as formas de pagamento.
 * Retorna PricingError se os dados de entrada forem inválidos.
 */
export function calculatePricing(
  input: PricingInput
): PricingResult | PricingError {
  // Validar entrada
  const validationError = validatePricingInput(input);
  if (validationError) return validationError;

  // Custo total do produto
  const totalCost =
    input.costPrice +
    input.packagingCost +
    input.inboundShippingCost +
    input.operationalCost;

  // Calcular todas as formas de pagamento
  const results: PaymentResult[] = [
    calculatePix(input, totalCost),
    calculateBoleto(input, totalCost),
    calculateDebit(input, totalCost),
    calculateCreditCash(input, totalCost),
    calculateCreditInstallment(input, totalCost),
  ];

  // Determinar melhor e pior forma de pagamento (por margem real)
  const sorted = [...results].sort((a, b) => b.realMarginRate - a.realMarginRate);
  const bestMethod = sorted[0]!.method;
  const worstMethod = sorted[sorted.length - 1]!.method;

  // Preço mínimo para promoção (menor preço sem prejuízo entre todos os métodos)
  const promotionMinPrice = Math.min(...results.map((r) => r.minPriceNoLoss));

  // Verificar se o produto é saudável (pelo menos um método com APROVADO)
  const hasUnhealthyProduct = results.every(
    (r) => r.diagnostic === "PREJUÍZO" || r.diagnostic === "RISCO"
  );

  const unhealthyAlert = hasUnhealthyProduct
    ? "Atenção: este produto apresenta margem crítica ou prejuízo em todas as formas de pagamento. Revise os custos ou a margem desejada."
    : undefined;

  return {
    input,
    totalCost,
    results,
    bestMethod,
    worstMethod,
    promotionMinPrice,
    hasUnhealthyProduct,
    unhealthyAlert,
  };
}

/**
 * Verifica se o resultado é um erro de precificação
 */
export function isPricingError(
  result: PricingResult | PricingError
): result is PricingError {
  return "code" in result && "message" in result;
}
