/**
 * pricing.batch.ts — Motor de Rateio Proporcional por Lote
 *
 * REGRA DE NEGÓCIO CENTRAL:
 *   Quando um lote de mercadorias chega, o Custo Operacional total
 *   (frete de importação, despachante, armazenagem, etc.) é rateado
 *   proporcionalmente ao valor (custo) de cada item no lote.
 *
 * FÓRMULA DO RATEIO:
 *   custo_operacional_item = (custo_total_item / custo_total_do_lote) * custo_operacional_total
 *
 * FÓRMULA DO CUSTO UNITÁRIO FINAL (após rateio):
 *   custo_final_unitario = custo_unitario_brl + (custo_operacional_item / quantidade)
 *
 * FÓRMULA DO PREÇO SUGERIDO SIMPLIFICADO (markup):
 *   preco_sugerido = custo_final_unitario / (1 - margem_desejada/100 - aliquota_imposto/100)
 *
 * ATENÇÃO — BUG DE TIPO CORRIGIDO:
 *   Todos os campos numéricos são coercidos com Number() antes de qualquer
 *   operação aritmética. Isso evita que strings vindas do formulário React
 *   causem concatenação em vez de soma (ex: "1250" + 50 = "125050").
 */

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface BatchItemInput {
  /** ID do produto vinculado (opcional — pode ser um produto novo ainda não salvo) */
  productId?: number;
  productName: string;
  /** Custo unitário em BRL (já convertido se USD) */
  unitCostBrl: number;
  quantity: number;
  /** Margem desejada em % (ex: 30 = 30%) */
  desiredMarginRate: number;
  /** Alíquota de imposto em % para o preço sugerido simplificado */
  estimatedTaxRate?: number;
}

export interface BatchItemResult extends BatchItemInput {
  /** custo_unitario_brl * quantidade */
  totalItemCost: number;
  /** Proporção deste item no custo total do lote (0..1) */
  costProportion: number;
  /** Custo operacional absorvido por este item = proporção * custo_operacional_total */
  allocatedOperationalCost: number;
  /** custo_unitario_brl + (allocatedOperationalCost / quantity) */
  finalUnitCost: number;
  /** Preço sugerido com margem e imposto (cálculo reverso) */
  suggestedPrice: number;
  /** Margem de contribuição unitária = preço_sugerido - finalUnitCost */
  contributionMargin: number;
}

export interface BatchPricingInput {
  items: BatchItemInput[];
  /** Custo operacional TOTAL do lote (frete, despachante, armazenagem, etc.) */
  totalOperationalCost: number;
}

export interface BatchPricingResult {
  items: BatchItemResult[];
  /** Custo total das mercadorias (soma de unitCostBrl * quantity) */
  totalCostOfGoods: number;
  totalOperationalCost: number;
  /** Custo total do lote = totalCostOfGoods + totalOperationalCost */
  grandTotal: number;
  /** Verificação de integridade: soma dos allocatedOperationalCost deve ≈ totalOperationalCost */
  allocationCheck: number;
}

export interface BatchPricingError {
  code: "EMPTY_BATCH" | "ZERO_COST" | "INVALID_ITEM" | "NEGATIVE_COST";
  message: string;
  itemIndex?: number;
}

// ─── Coerção Segura de Tipos ───────────────────────────────────────────────────

/**
 * Converte qualquer valor para número de forma segura.
 * Strings de formulário como "1.250,00" ou "1250.50" são normalizadas.
 * Retorna 0 para valores inválidos (NaN, null, undefined).
 */
function toNumber(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  if (typeof value === "string") {
    // Remove caracteres não numéricos exceto ponto e vírgula decimal
    // Suporta formato brasileiro "1.250,50" e americano "1250.50"
    const cleaned = value
      .replace(/[R$\s]/g, "")   // remove símbolo de moeda e espaços
      .replace(/\./g, "")        // remove separadores de milhar (ponto BR)
      .replace(",", ".");        // converte vírgula decimal para ponto
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ─── Validação ─────────────────────────────────────────────────────────────────

export function validateBatchInput(
  input: BatchPricingInput
): BatchPricingError | null {
  if (!input.items || input.items.length === 0) {
    return { code: "EMPTY_BATCH", message: "O lote deve ter pelo menos 1 item." };
  }

  const opCost = toNumber(input.totalOperationalCost);
  if (opCost < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "O custo operacional total não pode ser negativo.",
    };
  }

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i]!;

    if (!item.productName?.trim()) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1}: nome do produto é obrigatório.`,
        itemIndex: i,
      };
    }

    const unitCost = toNumber(item.unitCostBrl);
    if (unitCost < 0) {
      return {
        code: "NEGATIVE_COST",
        message: `Item ${i + 1} (${item.productName}): custo unitário não pode ser negativo.`,
        itemIndex: i,
      };
    }

    const qty = toNumber(item.quantity);
    if (qty < 1) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1} (${item.productName}): quantidade mínima é 1.`,
        itemIndex: i,
      };
    }

    const margin = toNumber(item.desiredMarginRate);
    if (margin < 0 || margin >= 100) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1} (${item.productName}): margem desejada deve estar entre 0% e 99.9%.`,
        itemIndex: i,
      };
    }
  }

  return null;
}

// ─── Motor Principal de Rateio ────────────────────────────────────────────────

/**
 * Calcula o rateio proporcional do custo operacional para cada item do lote.
 *
 * ALGORITMO:
 *  1. Coerce todos os campos numéricos para Number (evita bug de concatenação de strings)
 *  2. Soma o custo total das mercadorias do lote (base do rateio)
 *  3. Para cada item, calcula a proporção = custo_total_item / custo_total_lote
 *  4. Aloca o custo operacional = proporção * custo_operacional_total
 *  5. Calcula o custo final unitário = custo_unit + custo_operacional_alocado / qtd
 *  6. Calcula o preço sugerido via cálculo reverso de margem + imposto
 *
 * Se totalCostOfGoods = 0 (todos os itens custam R$ 0), distribui igualmente.
 */
export function calculateBatchPricing(
  input: BatchPricingInput
): BatchPricingResult | BatchPricingError {
  const validationError = validateBatchInput(input);
  if (validationError) return validationError;

  // ── PASSO 0: Coerção explícita de tipos — CRÍTICO ─────────────────────────
  // Campos vindos de inputs HTML chegam como string mesmo com type="number".
  // Sem isso, "1250" + 50 = "125050" (concatenação) em vez de 1300 (soma).
  const totalOperationalCost = toNumber(input.totalOperationalCost);

  const items = input.items.map((item) => ({
    ...item,
    unitCostBrl:       toNumber(item.unitCostBrl),
    quantity:          toNumber(item.quantity),
    desiredMarginRate: toNumber(item.desiredMarginRate),
    estimatedTaxRate:  toNumber(item.estimatedTaxRate ?? 0),
  }));

  // ── PASSO 1: Custo total das mercadorias ──────────────────────────────────
  const itemsWithTotalCost = items.map((item) => ({
    ...item,
    totalItemCost: item.unitCostBrl * item.quantity,
  }));

  const totalCostOfGoods = itemsWithTotalCost.reduce(
    (sum, item) => sum + item.totalItemCost,
    0
  );

  const grandTotal = totalCostOfGoods + totalOperationalCost;

  // ── PASSO 2 e 3: Proporção e rateio ──────────────────────────────────────
  const resultItems: BatchItemResult[] = itemsWithTotalCost.map((item) => {
    // Proporção deste item no custo total do lote
    // Se todos os itens custam 0, distribui igualmente
    const costProportion =
      totalCostOfGoods > 0
        ? item.totalItemCost / totalCostOfGoods
        : 1 / items.length;

    // Custo operacional rateado para este item (em R$)
    const allocatedOperationalCost = costProportion * totalOperationalCost;

    // ── PASSO 4: Custo unitário final ────────────────────────────────────
    // Ambos os operandos já são Number — sem risco de concatenação
    const finalUnitCost =
      item.unitCostBrl + allocatedOperationalCost / item.quantity;

    // ── PASSO 5: Preço sugerido — cálculo reverso ────────────────────────
    // Fórmula: preco = custo_final / (1 - margem% - imposto%)
    const taxRate    = item.estimatedTaxRate / 100;
    const marginRate = item.desiredMarginRate / 100;
    const divisor    = 1 - marginRate - taxRate;

    // Proteção: se divisor <= 0 (margem + imposto >= 100%), usa o custo como piso
    const suggestedPrice = divisor > 0.001 ? finalUnitCost / divisor : finalUnitCost;

    const contributionMargin = suggestedPrice - finalUnitCost;

    return {
      ...item,
      totalItemCost: item.totalItemCost,
      costProportion,
      allocatedOperationalCost,
      finalUnitCost,
      suggestedPrice,
      contributionMargin,
    };
  });

  // ── Verificação de integridade ─────────────────────────────────────────
  const allocationCheck = resultItems.reduce(
    (sum, item) => sum + item.allocatedOperationalCost,
    0
  );

  return {
    items: resultItems,
    totalCostOfGoods,
    totalOperationalCost,
    grandTotal,
    allocationCheck,
  };
}

/**
 * Type guard para verificar se o resultado é um erro
 */
export function isBatchPricingError(
  result: BatchPricingResult | BatchPricingError
): result is BatchPricingError {
  return "code" in result && "message" in result;
}

// ─── Utilitários de Formatação ─────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}
