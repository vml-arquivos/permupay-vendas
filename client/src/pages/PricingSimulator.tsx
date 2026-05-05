import { useState, useCallback } from "react";
import {
  calculatePricing,
  isPricingError,
  SUGGESTED_TAX_RATES,
  TAX_REGIME_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatPercent,
  type PricingInput,
  type PricingResult,
  type ProductCategory,
  type TaxRegime,
  type PaymentMethod,
  type PaymentResult,
} from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Calculator,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  Star,
} from "lucide-react";

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface FormState {
  productName: string;
  category: ProductCategory;
  ncm: string;
  costPrice: string;
  packagingCost: string;
  inboundShippingCost: string;
  operationalCost: string;
  desiredMarginRate: string;
  taxRegime: TaxRegime;
  taxCash: string;
  taxBoleto: string;
  taxDebit: string;
  taxCreditCash: string;
  taxCreditInstallment: string;
  boletoMonths: string;
  boletoMonthlyRate: string;
  boletoFixedFee: string;
  boletoDefaultRisk: string;
  boletoCustomerPaysInterest: boolean;
  cardDebitFee: string;
  cardCreditCashFee: string;
  cardCreditInstallmentFee: string;
  cardInstallments: string;
  cardAnticipationRate: string;
  cardMonthlyRate: string;
  cardCustomerPaysInterest: boolean;
}

const defaultForm: FormState = {
  productName: "",
  category: "CELULAR",
  ncm: "",
  costPrice: "",
  packagingCost: "0",
  inboundShippingCost: "0",
  operationalCost: "0",
  desiredMarginRate: "30",
  taxRegime: "SIMPLES_NACIONAL",
  taxCash: "6",
  taxBoleto: "6",
  taxDebit: "6",
  taxCreditCash: "6",
  taxCreditInstallment: "6",
  boletoMonths: "3",
  boletoMonthlyRate: "2",
  boletoFixedFee: "3.50",
  boletoDefaultRisk: "3",
  boletoCustomerPaysInterest: false,
  cardDebitFee: "1.5",
  cardCreditCashFee: "2.5",
  cardCreditInstallmentFee: "3.5",
  cardInstallments: "6",
  cardAnticipationRate: "1.5",
  cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string): number {
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function diagnosticConfig(status: string) {
  switch (status) {
    case "APROVADO":
      return {
        color: "bg-success/10 text-success border-success/30",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        dot: "bg-success",
      };
    case "ATENÇÃO":
      return {
        color: "bg-warning/10 text-warning-foreground border-warning/30",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        dot: "bg-warning",
      };
    case "RISCO":
      return {
        color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800/30",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        dot: "bg-orange-500",
      };
    case "PREJUÍZO":
      return {
        color: "bg-danger/10 text-danger border-danger/30",
        icon: <XCircle className="w-3.5 h-3.5" />,
        dot: "bg-danger",
      };
    default:
      return {
        color: "bg-muted text-muted-foreground border-border",
        icon: null,
        dot: "bg-muted-foreground",
      };
  }
}

function methodIcon(method: PaymentMethod) {
  switch (method) {
    case "PIX":
      return <Sparkles className="w-4 h-4" />;
    case "BOLETO":
      return <Banknote className="w-4 h-4" />;
    case "DEBITO":
      return <CreditCard className="w-4 h-4" />;
    case "CREDITO_A_VISTA":
      return <CreditCard className="w-4 h-4" />;
    case "CREDITO_PARCELADO":
      return <Tag className="w-4 h-4" />;
  }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  tooltip,
  children,
  required,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-foreground/80">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        min={min}
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

function ResultCard({
  result,
  isBest,
  isWorst,
}: {
  result: PaymentResult;
  isBest: boolean;
  isWorst: boolean;
}) {
  const diag = diagnosticConfig(result.diagnostic);

  return (
    <div
      className={`relative rounded-xl border bg-card p-5 transition-all duration-200 ${
        isBest
          ? "border-success/50 shadow-md shadow-success/10 ring-1 ring-success/20"
          : isWorst
          ? "border-danger/30 opacity-80"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      {isBest && (
        <div className="absolute -top-2.5 left-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success text-success-foreground shadow-sm">
            <Star className="w-3 h-3 fill-current" /> Melhor opção
          </span>
        </div>
      )}
      {isWorst && (
        <div className="absolute -top-2.5 left-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Menor margem
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {methodIcon(result.method)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{result.methodLabel}</p>
            {result.installments > 1 && (
              <p className="text-xs text-muted-foreground">
                {result.installments}x de {formatCurrency(result.installmentValue)}
              </p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${diag.color}`}
        >
          {diag.icon}
          {result.diagnostic}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            {formatCurrency(result.suggestedPrice)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Psicológico: <span className="font-medium text-foreground">{formatCurrency(result.psychologicalPrice)}</span>
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Lucro líquido</p>
          <p
            className={`text-sm font-semibold ${
              result.netProfit >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(result.netProfit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Margem real</p>
          <p className="text-sm font-semibold text-foreground">
            {formatPercent(result.realMarginRate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Imposto</p>
          <p className="text-sm font-medium text-foreground">
            {formatCurrency(result.totalTax)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Markup</p>
          <p className="text-sm font-medium text-foreground">
            {formatPercent(result.markup)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Mín. sem prejuízo:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(result.minPriceNoLoss)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PricingSimulator() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBoleto, setShowBoleto] = useState(true);
  const [showCard, setShowCard] = useState(true);

  const set = useCallback(
    (field: keyof FormState) => (value: string | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleTaxRegimeChange = useCallback(
    (regime: TaxRegime) => {
      const rates = SUGGESTED_TAX_RATES[regime];
      setForm((prev) => ({
        ...prev,
        taxRegime: regime,
        taxCash: String(rates.cash),
        taxBoleto: String(rates.boleto),
        taxDebit: String(rates.debit),
        taxCreditCash: String(rates.creditCash),
        taxCreditInstallment: String(rates.creditInstallment),
      }));
    },
    []
  );

  const handleCalculate = useCallback(() => {
    setError(null);
    setResult(null);

    if (!form.productName.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (!form.costPrice || parseNum(form.costPrice) <= 0) {
      setError("Informe um preço de custo válido (maior que zero).");
      return;
    }

    const input: PricingInput = {
      productName: form.productName.trim(),
      category: form.category,
      ncm: form.ncm.trim() || undefined,
      costPrice: parseNum(form.costPrice),
      packagingCost: parseNum(form.packagingCost),
      inboundShippingCost: parseNum(form.inboundShippingCost),
      operationalCost: parseNum(form.operationalCost),
      desiredMarginRate: parseNum(form.desiredMarginRate),
      taxRegime: form.taxRegime,
      taxRates: {
        cash: parseNum(form.taxCash),
        boleto: parseNum(form.taxBoleto),
        debit: parseNum(form.taxDebit),
        creditCash: parseNum(form.taxCreditCash),
        creditInstallment: parseNum(form.taxCreditInstallment),
      },
      boleto: {
        months: Math.max(1, Math.round(parseNum(form.boletoMonths))),
        monthlyInterestRate: parseNum(form.boletoMonthlyRate),
        fixedFee: parseNum(form.boletoFixedFee),
        defaultRiskRate: parseNum(form.boletoDefaultRisk),
        customerPaysInterest: form.boletoCustomerPaysInterest,
      },
      card: {
        debitFeeRate: parseNum(form.cardDebitFee),
        creditCashFeeRate: parseNum(form.cardCreditCashFee),
        creditInstallmentFeeRate: parseNum(form.cardCreditInstallmentFee),
        installments: Math.max(1, Math.round(parseNum(form.cardInstallments))),
        anticipationRate: parseNum(form.cardAnticipationRate),
        monthlyInterestRate: parseNum(form.cardMonthlyRate),
        customerPaysInterest: form.cardCustomerPaysInterest,
      },
    };

    const calc = calculatePricing(input);

    if (isPricingError(calc)) {
      setError(calc.message);
      return;
    }

    setResult(calc);
    setTimeout(() => {
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [form]);

  const handleReset = useCallback(() => {
    setForm(defaultForm);
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Calculator className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground tracking-tight">
                  PermuPay Vendas
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Simulador de Precificação — Distrito Federal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs hidden sm:flex">
                <Smartphone className="w-3 h-3 mr-1" />
                DF · 2025
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-7xl mx-auto">
          {/* Título da página */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Simulador de Precificação
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Calcule o preço ideal de venda por forma de pagamento, considerando custos, impostos, taxas e margem desejada.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
            {/* ─── Coluna esquerda: Formulário ─── */}
            <div className="space-y-6">
              {/* Dados do Produto */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <SectionTitle
                  icon={<Tag className="w-4 h-4" />}
                  title="Dados do Produto"
                  subtitle="Informações básicas e custos de aquisição"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FormField label="Nome do produto" required>
                      <Input
                        value={form.productName}
                        onChange={(e) => set("productName")(e.target.value)}
                        placeholder="Ex: iPhone 15 Pro 256GB"
                        className="h-9 text-sm"
                      />
                    </FormField>
                  </div>
                  <FormField label="Categoria" required>
                    <Select
                      value={form.category}
                      onValueChange={(v) => set("category")(v as ProductCategory)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CELULAR">Celular</SelectItem>
                        <SelectItem value="ELETRONICO">Eletrônico</SelectItem>
                        <SelectItem value="PERFUME">Perfume</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label="NCM (opcional)"
                    tooltip="Nomenclatura Comum do Mercosul. Consulte seu contador para confirmar."
                  >
                    <Input
                      value={form.ncm}
                      onChange={(e) => set("ncm")(e.target.value)}
                      placeholder="Ex: 8517.12.31"
                      className="h-9 text-sm font-mono"
                    />
                  </FormField>
                  <FormField label="Preço de custo" required>
                    <NumericInput
                      value={form.costPrice}
                      onChange={set("costPrice")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Custo de embalagem"
                    tooltip="Caixas, plástico bolha, fita, etc."
                  >
                    <NumericInput
                      value={form.packagingCost}
                      onChange={set("packagingCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Frete de compra"
                    tooltip="Custo de frete para adquirir o produto."
                  >
                    <NumericInput
                      value={form.inboundShippingCost}
                      onChange={set("inboundShippingCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Custo operacional"
                    tooltip="Custo fixo rateado por venda (aluguel, energia, mão de obra, etc.)."
                  >
                    <NumericInput
                      value={form.operationalCost}
                      onChange={set("operationalCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Margem líquida desejada"
                    required
                    tooltip="Percentual de lucro líquido sobre o preço de venda que você deseja obter."
                  >
                    <NumericInput
                      value={form.desiredMarginRate}
                      onChange={set("desiredMarginRate")}
                      suffix="%"
                      placeholder="30"
                      min={0}
                    />
                  </FormField>
                </div>
              </div>

              {/* Campos Fiscais */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <SectionTitle
                  icon={<AlertTriangle className="w-4 h-4" />}
                  title="Configuração Fiscal"
                  subtitle="Regime tributário e alíquotas por forma de pagamento"
                />

                {/* Aviso fiscal obrigatório */}
                <div className="mb-5 flex gap-3 p-3.5 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-warning-foreground leading-relaxed">
                    <strong>Aviso fiscal:</strong> Alíquotas sugeridas automaticamente com base no regime tributário selecionado. Confirme NCM, regime tributário, CST/CSOSN e eventual substituição tributária com seu contador antes de usar em operações reais.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField
                    label="Regime tributário"
                    tooltip="Selecione o regime da sua empresa. As alíquotas serão sugeridas automaticamente, mas você pode editá-las."
                  >
                    <Select
                      value={form.taxRegime}
                      onValueChange={(v) => handleTaxRegimeChange(v as TaxRegime)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TAX_REGIME_LABELS) as TaxRegime[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {TAX_REGIME_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Pix / À Vista", field: "taxCash" as const },
                      { label: "Boleto", field: "taxBoleto" as const },
                      { label: "Débito", field: "taxDebit" as const },
                      { label: "Créd. à Vista", field: "taxCreditCash" as const },
                      { label: "Créd. Parc.", field: "taxCreditInstallment" as const },
                    ].map(({ label, field }) => (
                      <FormField key={field} label={label}>
                        <NumericInput
                          value={form[field]}
                          onChange={set(field)}
                          suffix="%"
                          min={0}
                        />
                      </FormField>
                    ))}
                  </div>
                </div>
              </div>

              {/* Configurações Avançadas */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Configurações de Boleto e Cartão
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Taxas, juros, parcelas e opções de repasse
                      </p>
                    </div>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="px-6 pb-6 space-y-6 border-t border-border">
                    {/* Boleto */}
                    <div className="pt-5">
                      <button
                        type="button"
                        onClick={() => setShowBoleto(!showBoleto)}
                        className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <Banknote className="w-4 h-4" />
                        Boleto Bancário
                        {showBoleto ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                        )}
                      </button>
                      {showBoleto && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField
                            label="Quantidade de meses"
                            tooltip="Número de parcelas do boleto."
                          >
                            <NumericInput
                              value={form.boletoMonths}
                              onChange={set("boletoMonths")}
                              min={1}
                            />
                          </FormField>
                          <FormField
                            label="Juros mensal"
                            tooltip="Taxa de juros mensal aplicada ao boleto."
                          >
                            <NumericInput
                              value={form.boletoMonthlyRate}
                              onChange={set("boletoMonthlyRate")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField
                            label="Taxa fixa de emissão"
                            tooltip="Custo fixo cobrado pela emissão de cada boleto."
                          >
                            <NumericInput
                              value={form.boletoFixedFee}
                              onChange={set("boletoFixedFee")}
                              prefix="R$"
                              min={0}
                            />
                          </FormField>
                          <FormField
                            label="Risco de inadimplência"
                            tooltip="Percentual estimado de não pagamento."
                          >
                            <NumericInput
                              value={form.boletoDefaultRisk}
                              onChange={set("boletoDefaultRisk")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <div className="col-span-2 sm:col-span-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  Juros repassado ao cliente
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {form.boletoCustomerPaysInterest
                                    ? "Cliente paga os juros separadamente"
                                    : "Juros embutido no preço (empresa absorve)"}
                                </p>
                              </div>
                              <Switch
                                checked={form.boletoCustomerPaysInterest}
                                onCheckedChange={(v) =>
                                  set("boletoCustomerPaysInterest")(v)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cartão */}
                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowCard(!showCard)}
                        className="flex items-center gap-2 mb-4 mt-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Cartão de Crédito e Débito
                        {showCard ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                        )}
                      </button>
                      {showCard && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField label="Taxa de débito">
                            <NumericInput
                              value={form.cardDebitFee}
                              onChange={set("cardDebitFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Taxa crédito à vista">
                            <NumericInput
                              value={form.cardCreditCashFee}
                              onChange={set("cardCreditCashFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Taxa crédito parcelado">
                            <NumericInput
                              value={form.cardCreditInstallmentFee}
                              onChange={set("cardCreditInstallmentFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Número de parcelas">
                            <NumericInput
                              value={form.cardInstallments}
                              onChange={set("cardInstallments")}
                              min={1}
                            />
                          </FormField>
                          <FormField
                            label="Taxa de antecipação"
                            tooltip="Taxa cobrada pela antecipação do recebível parcelado."
                          >
                            <NumericInput
                              value={form.cardAnticipationRate}
                              onChange={set("cardAnticipationRate")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField
                            label="Juros mensal parcelamento"
                            tooltip="Juros mensais aplicados ao parcelamento no cartão."
                          >
                            <NumericInput
                              value={form.cardMonthlyRate}
                              onChange={set("cardMonthlyRate")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <div className="col-span-2 sm:col-span-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  Juros absorvido pela empresa
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {form.cardCustomerPaysInterest
                                    ? "Empresa absorve os juros (sem juros ao cliente)"
                                    : "Juros repassado ao cliente no parcelamento"}
                                </p>
                              </div>
                              <Switch
                                checked={form.cardCustomerPaysInterest}
                                onCheckedChange={(v) =>
                                  set("cardCustomerPaysInterest")(v)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCalculate}
                  className="flex-1 h-11 text-sm font-semibold shadow-sm"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular Preços
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="h-11 px-5 text-sm"
                >
                  Limpar
                </Button>
              </div>

              {/* Erro de validação */}
              {error && (
                <div className="flex gap-3 p-4 rounded-lg bg-danger/10 border border-danger/30">
                  <XCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}
            </div>

            {/* ─── Coluna direita: Resumo de custos ─── */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm sticky top-20">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Resumo de Custos
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Preço de custo", value: parseNum(form.costPrice) },
                    { label: "Embalagem", value: parseNum(form.packagingCost) },
                    { label: "Frete de compra", value: parseNum(form.inboundShippingCost) },
                    { label: "Custo operacional", value: parseNum(form.operationalCost) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Custo total
                    </span>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {formatCurrency(
                        parseNum(form.costPrice) +
                          parseNum(form.packagingCost) +
                          parseNum(form.inboundShippingCost) +
                          parseNum(form.operationalCost)
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Margem desejada
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {form.desiredMarginRate || "0"}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      Regime tributário
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {TAX_REGIME_LABELS[form.taxRegime]}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Preencha o formulário e clique em{" "}
                    <strong className="text-foreground">Calcular Preços</strong> para
                    ver a simulação completa por forma de pagamento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Resultados ─── */}
          {result && (
            <div id="results-section" className="mt-10 space-y-8">
              {/* Alerta de produto não saudável */}
              {result.hasUnhealthyProduct && result.unhealthyAlert && (
                <div className="flex gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30">
                  <AlertTriangle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      Produto com margem crítica
                    </p>
                    <p className="text-sm text-danger/80 mt-0.5">
                      {result.unhealthyAlert}
                    </p>
                  </div>
                </div>
              )}

              {/* Cabeçalho dos resultados */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    Resultados — {result.input.productName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Custo total:{" "}
                    <strong className="text-foreground">
                      {formatCurrency(result.totalCost)}
                    </strong>{" "}
                    · Margem desejada:{" "}
                    <strong className="text-foreground">
                      {formatPercent(result.input.desiredMarginRate)}
                    </strong>
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-success" />
                    Melhor: {PAYMENT_METHOD_LABELS[result.bestMethod]}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-danger" />
                    Pior: {PAYMENT_METHOD_LABELS[result.worstMethod]}
                  </div>
                </div>
              </div>

              {/* Cards de resultado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {result.results.map((r) => (
                  <ResultCard
                    key={r.method}
                    result={r}
                    isBest={r.method === result.bestMethod}
                    isWorst={r.method === result.worstMethod}
                  />
                ))}
              </div>

              {/* Preço mínimo para promoção */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Tag className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Preço mínimo para promoção
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Menor preço possível sem prejuízo em qualquer forma de pagamento:{" "}
                    <strong className="text-primary text-sm">
                      {formatCurrency(result.promotionMinPrice)}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Tabela Comparativa */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tabela Comparativa
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comparação detalhada entre todas as formas de pagamento
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Forma de Pagamento
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Preço Sugerido
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Parcela
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Imposto
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Taxas/Juros
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Lucro Líquido
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Margem Real
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Markup
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Diagnóstico
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, i) => {
                        const diag = diagnosticConfig(r.diagnostic);
                        const isBest = r.method === result.bestMethod;
                        return (
                          <tr
                            key={r.method}
                            className={`border-b border-border last:border-0 transition-colors ${
                              isBest
                                ? "bg-success/5"
                                : i % 2 === 0
                                ? "bg-transparent"
                                : "bg-muted/20"
                            }`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {isBest && (
                                  <Star className="w-3 h-3 text-success fill-current flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium text-foreground">
                                  {r.methodLabel}
                                </span>
                                {r.installments > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({r.installments}x)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs font-semibold text-foreground tabular-nums">
                                {formatCurrency(r.suggestedPrice)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs text-foreground tabular-nums">
                                {r.installments > 1
                                  ? formatCurrency(r.installmentValue)
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs text-foreground tabular-nums">
                                {formatCurrency(r.totalTax)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs text-foreground tabular-nums">
                                {formatCurrency(r.totalFees + r.totalInterest)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span
                                className={`text-xs font-semibold tabular-nums ${
                                  r.netProfit >= 0 ? "text-success" : "text-danger"
                                }`}
                              >
                                {formatCurrency(r.netProfit)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs font-medium text-foreground tabular-nums">
                                {formatPercent(r.realMarginRate)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="text-xs text-foreground tabular-nums">
                                {formatPercent(r.markup)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${diag.color}`}
                              >
                                {diag.icon}
                                {r.diagnostic}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aviso fiscal no rodapé dos resultados */}
              <div className="flex gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Aviso fiscal:</strong> Alíquota sugerida. Confirme NCM, regime tributário, CST/CSOSN e eventual substituição tributária com contador. Este simulador não realiza cálculo fiscal definitivo por NCM.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-card/50">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              PermuPay Vendas · Simulador de Precificação · Distrito Federal
            </p>
            <p className="text-xs text-muted-foreground">
              Os valores calculados são estimativas. Consulte um contador para decisões fiscais.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
