import { calculatePricing } from "./shared/pricingCalculator";

const baseInput = {
  productName: "Smartphone XYZ",
  category: "CELULAR" as const,
  ncm: "8517.12.31",
  costPrice: 500,
  packagingCost: 10,
  inboundShippingCost: 20,
  operationalCost: 15,
  desiredMarginRate: 20,
  taxRegime: "SIMPLES_NACIONAL" as const,
  taxRates: {
    cash: 6,
    boleto: 6,
    debit: 6,
    creditCash: 6,
    creditInstallment: 6,
  },
  boleto: {
    months: 3,
    monthlyInterestRate: 2,
    fixedFee: 3.5,
    defaultRiskRate: 3,
    customerPaysInterest: false,
  },
  card: {
    debitFeeRate: 1.5,
    creditCashFeeRate: 2.5,
    creditInstallmentFeeRate: 3.5,
    installments: 6,
    anticipationRate: 1.5,
    monthlyInterestRate: 1.99,
    customerPaysInterest: false,
  },
};

const result = calculatePricing(baseInput);
if (!("code" in result)) {
  const pix = result.results.find((r) => r.method === "PIX");
  console.log("PIX diagnostic:", pix?.diagnostic);
  console.log("PIX realMarginRate:", pix?.realMarginRate);
  console.log("PIX netProfit:", pix?.netProfit);
  console.log("PIX suggestedPrice:", pix?.suggestedPrice);
}
