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

export type DiagnosticStatus = "EXCELENTE" | "SAUDAVEL" | "ATENCAO" | "RISCO" | "PREJUIZO";

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
 * EXCELENTE — margem real >= margem desejada + 10%
 * SAUDÁVEL  — margem real >= margem desejada (mas < desejada + 10%)
 * ATENÇÃO  — margem real abaixo da desejada, mas acima de 10%
 * RISCO    — margem real menor que 10% (mas lucro positivo)
 * PREJUÍZO — lucro líquido negativo
 */
export function getDiagnostic(
  realMarginRate: number,
  netProfit: number,
  desiredMarginRate?: number
): DiagnosticStatus {
  if (netProfit < 0) return "PREJUIZO";
  if (realMarginRate < 10) return "RISCO";
  const desired = desiredMarginRate ?? 10;
  if (realMarginRate < desired) return "ATENCAO";
  if (realMarginRate >= desired + 10) return "EXCELENTE";
  return "SAUDAVEL";
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
 * 
 * Fórmula: preço = custo + (custo × margem%) + (preço × imposto%)
 * Reorganizado: preço = (custo × (1 + margem%)) / (1 - imposto%)
 */
function calculatePix(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { taxRates, desiredMarginRate } = input;
  
  // Lucro desejado em valor absoluto (sobre o custo)
  const desiredProfit = costPrice * (desiredMarginRate / 100);
  
  // Preço base = custo + lucro desejado
  const priceBase = costPrice + desiredProfit;
  
  // Imposto sobre o preço final
  const taxRate = taxRates.cash / 100;
  
  // Preço final = (preço base) / (1 - taxa de imposto)
  const suggestedPrice = priceBase / (1 - taxRate);
  
  const totalTax = suggestedPrice * taxRate;
  const totalCosts = totalCost + totalTax;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  // Preço mínimo sem prejuízo (apenas impostos, sem margem)
  const minPriceNoLoss = totalCost / (1 - taxRate);
  
  // Preço mínimo com margem desejada
  const minPriceWithMargin = suggestedPrice;

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
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss,
    minPriceWithMargin,
  };
}

/**
 * Calcula o preço para Boleto Bancário
 */
function calculateBoleto(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { boleto, taxRates, desiredMarginRate } = input;

  // Lucro desejado em valor absoluto (sobre o custo)
  const desiredProfit = costPrice * (desiredMarginRate / 100);
  
  // Preço base = custo + lucro desejado
  const priceBase = costPrice + desiredProfit;
  
  // Taxas em percentual
  const taxRate = taxRates.boleto / 100;
  const riskRate = boleto.defaultRiskRate / 100;
  
  // Preço sem juros = (preço base + taxa fixa) / (1 - taxa% - risco%)
  const priceWithoutInterest = (priceBase + boleto.fixedFee) / (1 - taxRate - riskRate);
  
  // Aplicar juros compostos
  let suggestedPrice: number;
  let totalInterest: number;

  if (boleto.customerPaysInterest) {
    // Juros repassado ao cliente: preço sem juros, cliente paga a mais
    suggestedPrice = priceWithoutInterest;
    totalInterest = compoundInterest(priceWithoutInterest, boleto.monthlyInterestRate, boleto.months) - priceWithoutInterest;
  } else {
    // Juros embutido no preço: empresa absorve os juros
    suggestedPrice = compoundInterest(priceWithoutInterest, boleto.monthlyInterestRate, boleto.months);
    totalInterest = suggestedPrice - priceWithoutInterest;
  }

  const totalTax = suggestedPrice * taxRate;
  const totalFees = boleto.fixedFee + suggestedPrice * riskRate;
  const totalCosts = totalCost + totalTax + totalFees + (boleto.customerPaysInterest ? 0 : totalInterest);
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - costPrice) / costPrice) * 100;
  const installmentValue = suggestedPrice / boleto.months;
  
  const minPriceNoLoss = totalCost / (1 - taxRate - riskRate);
  const minPriceWithMargin = suggestedPrice;

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
function calculateDebit(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  // Lucro desejado em valor absoluto (sobre o custo)
  const desiredProfit = costPrice * (desiredMarginRate / 100);
  
  // Preço base = custo + lucro desejado
  const priceBase = costPrice + desiredProfit;
  
  // Taxas em percentual
  const taxRate = taxRates.debit / 100;
  const feeRate = card.debitFeeRate / 100;
  
  // Preço = (preço base) / (1 - taxa% - taxa cartão%)
  const suggestedPrice = priceBase / (1 - taxRate - feeRate);
  
  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * feeRate;
  const totalCosts = totalCost + totalTax + totalFees;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  const minPriceNoLoss = totalCost / (1 - (taxRate + feeRate));
  const minPriceWithMargin = suggestedPrice;

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
function calculateCreditCash(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  // Lucro desejado em valor absoluto (sobre o custo)
  const desiredProfit = costPrice * (desiredMarginRate / 100);
  
  // Preço base = custo + lucro desejado
  const priceBase = costPrice + desiredProfit;
  
  // Taxas em percentual
  const taxRate = taxRates.creditCash / 100;
  const feeRate = card.creditCashFeeRate / 100;
  
  // Preço = (preço base) / (1 - taxa% - taxa cartão%)
  const suggestedPrice = priceBase / (1 - taxRate - feeRate);
  
  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * feeRate;
  const totalCosts = totalCost + totalTax + totalFees;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  const minPriceNoLoss = totalCost / (1 - (taxRate + feeRate));
  const minPriceWithMargin = suggestedPrice;

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
function calculateCreditInstallment(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;

  // Lucro desejado em valor absoluto (sobre o custo)
  const desiredProfit = costPrice * (desiredMarginRate / 100);
  
  // Preço base = custo + lucro desejado
  const priceBase = costPrice + desiredProfit;
  
  // Taxas em percentual
  const taxRate = taxRates.creditInstallment / 100;
  const feeRate = card.creditInstallmentFeeRate / 100;
  const anticipationRate = card.anticipationRate / 100;
  
  // Preço sem juros = (preço base) / (1 - taxa% - taxa cartão% - antecipação%)
  const priceWithoutInterest = priceBase / (1 - taxRate - feeRate - anticipationRate);
  
  // Aplicar juros compostos
  let suggestedPrice: number;
  let totalInterest: number;

  if (card.customerPaysInterest) {
    // Juros repassado ao cliente
    suggestedPrice = priceWithoutInterest;
    totalInterest = compoundInterest(priceWithoutInterest, card.monthlyInterestRate, card.installments) - priceWithoutInterest;
  } else {
    // Juros embutido no preço
    suggestedPrice = compoundInterest(priceWithoutInterest, card.monthlyInterestRate, card.installments);
    totalInterest = suggestedPrice - priceWithoutInterest;
  }

  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * (feeRate + anticipationRate);
  const totalCosts = totalCost + totalTax + totalFees + (card.customerPaysInterest ? 0 : totalInterest);
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const markup = ((suggestedPrice - costPrice) / costPrice) * 100;
  const installmentValue = suggestedPrice / card.installments;
  
  const minPriceNoLoss = totalCost / (1 - (taxRate + feeRate + anticipationRate));
  const minPriceWithMargin = suggestedPrice;

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

// ─── Função Principal de Cálculo ───────────────────────────────────────────────

/**
 * Calcula a precificação completa para um produto
 */
export function calculatePricing(
  input: PricingInput
): PricingResult | PricingError {
  // Validar entrada
  const validationError = validatePricingInput(input);
  if (validationError) {
    return validationError;
  }

  // Separar custo de produto do custo total
  const costPrice = input.costPrice; // Apenas o preço de custo
  const totalCost =
    input.costPrice +
    input.packagingCost +
    input.inboundShippingCost +
    input.operationalCost; // Custo total com todos os adicionais

  // Calcular todas as formas de pagamento
  const results: PaymentResult[] = [
    calculatePix(input, costPrice, totalCost),
    calculateBoleto(input, costPrice, totalCost),
    calculateDebit(input, costPrice, totalCost),
    calculateCreditCash(input, costPrice, totalCost),
    calculateCreditInstallment(input, costPrice, totalCost),
  ];

  // Determinar melhor e pior forma de pagamento (por margem real)
  const sorted = [...results].sort((a, b) => b.realMarginRate - a.realMarginRate);
  const bestMethod = sorted[0]!.method;
  const worstMethod = sorted[sorted.length - 1]!.method;

  // Preço mínimo para promoção (menor preço sem prejuízo entre todos os métodos)
  const promotionMinPrice = Math.min(...results.map((r) => r.minPriceNoLoss));

  // Verificar se o produto é saudável (pelo menos um método com APROVADO)
  const hasUnhealthyProduct = results.every(
    (r) => r.diagnostic === "PREJUIZO" || r.diagnostic === "RISCO"
  );

  const unhealthyAlert = hasUnhealthyProduct
    ? "Atenção: este produto apresenta margem crítica ou prejuízo em todas as formas de pagamento. Revise os custos, taxas financeiras e margem desejada."
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
