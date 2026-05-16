/**
 * ProductForm.tsx — Cadastro e Edição de Produto
 *
 * Formulário unificado: identidade, custos, margem, fiscal, boleto, cartão,
 * cards de resultado e oferta comercial para vitrine.
 *
 * REGRAS:
 * - Não expõe custo, margem, imposto ou lucro na vitrine.
 * - Salva preços calculados (suggestedPrice*) para exibição pública.
 * - Motor de cálculo importado de shared/pricingCalculator.ts (fonte única).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
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
  type PaymentResult,
  type ProductCategory,
  type TaxRegime,
  type PaymentMethod,
} from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Calculator,
  Package,
  DollarSign,
  Percent,
  CreditCard,
  Banknote,
  Sparkles,
  Tag,
  Eye,
  EyeOff,
  Save,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
} from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type MarginMode = "PERCENT" | "VALUE";
type PaymentPlatform = "MERCADO_PAGO" | "PAGSEGURO" | "OUTRO";

interface FormState {
  // Identidade
  name: string;
  shortDescription: string;
  description: string;
  category: ProductCategory;
  categoryLabel: string;
  ncm: string;
  promoTag: string;
  published: boolean;
  active: boolean;
  notes: string;
  // Moeda / custo
  costCurrency: "BRL" | "USD";
  costPrice: string;
  costPriceUsd: string;
  usdExchangeRate: string;
  packagingCost: string;
  inboundShippingCost: string;
  operationalCost: string;
  // Estoque
  stockQuantity: string;
  minimumStock: string;
  // Margem
  marginMode: MarginMode;
  desiredMarginRate: string;
  desiredMarginValue: string;
  // Fiscal
  taxRegime: TaxRegime;
  taxCash: string;
  taxBoleto: string;
  taxDebit: string;
  taxCreditCash: string;
  taxCreditInstallment: string;
  // Boleto
  boletoMonths: string;
  boletoMonthlyRate: string;
  boletoFixedFee: string;
  boletoDefaultRisk: string;
  boletoCustomerPaysInterest: boolean;
  // Cartão
  cardDebitFee: string;
  cardCreditCashFee: string;
  cardCreditInstallmentFee: string;
  cardInstallments: string;
  cardAnticipationRate: string;
  cardMonthlyRate: string;
  cardCustomerPaysInterest: boolean;
  // Pagamento externo
  paymentPlatform: PaymentPlatform;
  pixKey: string;
  pixLink: string;
  cardPaymentUrl: string;
  boletoUrl: string;
}

const defaultForm: FormState = {
  name: "",
  shortDescription: "",
  description: "",
  category: "CELULAR",
  categoryLabel: "",
  ncm: "",
  promoTag: "",
  published: false,
  active: true,
  notes: "",
  costCurrency: "BRL",
  costPrice: "",
  costPriceUsd: "",
  usdExchangeRate: "5.50",
  packagingCost: "",
  inboundShippingCost: "",
  operationalCost: "",
  stockQuantity: "",
  minimumStock: "",
  marginMode: "PERCENT",
  desiredMarginRate: "30",
  desiredMarginValue: "",
  taxRegime: "SIMPLES_NACIONAL",
  taxCash: "6",
  taxBoleto: "6",
  taxDebit: "6",
  taxCreditCash: "6",
  taxCreditInstallment: "6",
  boletoMonths: "3",
  boletoMonthlyRate: "1.99",
  boletoFixedFee: "3.50",
  boletoDefaultRisk: "2",
  boletoCustomerPaysInterest: false,
  cardDebitFee: "1.5",
  cardCreditCashFee: "2.5",
  cardCreditInstallmentFee: "3.5",
  cardInstallments: "6",
  cardAnticipationRate: "1.5",
  cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
  paymentPlatform: "MERCADO_PAGO",
  pixKey: "",
  pixLink: "",
  cardPaymentUrl: "",
  boletoUrl: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function n(val: string): number {
  if (!val) return 0;
  const v = parseFloat(val.replace(",", "."));
  return isNaN(v) ? 0 : v;
}

function diagnosticConfig(status: string) {
  switch (status) {
    case "EXCELENTE":
      return { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "SAUDAVEL":
      return { color: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "ATENCAO":
      return { color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: <AlertCircle className="w-3.5 h-3.5" /> };
    case "RISCO":
      return { color: "bg-orange-50 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    case "PREJUIZO":
      return { color: "bg-red-50 text-red-700 border-red-200", icon: <XCircle className="w-3.5 h-3.5" /> };
    default:
      return { color: "bg-gray-50 text-gray-700 border-gray-200", icon: null };
  }
}

function methodIcon(method: PaymentMethod) {
  switch (method) {
    case "PIX": return <Sparkles className="w-4 h-4" />;
    case "BOLETO": return <Banknote className="w-4 h-4" />;
    case "DEBITO": return <CreditCard className="w-4 h-4" />;
    case "CREDITO_A_VISTA": return <CreditCard className="w-4 h-4" />;
    case "CREDITO_PARCELADO": return <Tag className="w-4 h-4" />;
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FF({ label, tooltip, required, children }: {
  label: string;
  tooltip?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-foreground/80">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
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

function NI({ value, onChange, placeholder, prefix, suffix, disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-xs text-muted-foreground font-medium pointer-events-none">{prefix}</span>}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        step="any"
        min={0}
        disabled={disabled}
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {suffix && <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">{suffix}</span>}
    </div>
  );
}

function ResultCard({ result, isBest, isWorst }: { result: PaymentResult; isBest: boolean; isWorst: boolean }) {
  const diag = diagnosticConfig(result.diagnostic);
  return (
    <div className={`relative rounded-xl border bg-card p-4 transition-all duration-200 ${
      isBest ? "border-green-300 shadow-md ring-1 ring-green-200" : isWorst ? "border-red-200 opacity-80" : "border-border"
    }`}>
      {isBest && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white">
          <TrendingUp className="w-3 h-3" /> Melhor opção
        </span>
      )}
      {isWorst && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400 text-white">
          <TrendingDown className="w-3 h-3" /> Menor margem
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{methodIcon(result.method)}</span>
          <div>
            <p className="text-xs font-semibold text-foreground">{result.methodLabel}</p>
            {result.installments > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {result.installments}x de {formatCurrency(result.installmentValue)}
              </p>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${diag.color}`}>
          {diag.icon}{result.diagnostic}
        </span>
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight mb-3">
        {formatCurrency(result.suggestedPrice)}
      </div>
      <div className="space-y-1 text-xs border-t pt-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Custo base:</span>
          <span>{formatCurrency(result.baseCost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Margem desejada:</span>
          <span className="text-green-600 font-medium">+{formatCurrency(result.marginValue)}</span>
        </div>
        <div className="flex justify-between border-t border-dashed pt-1">
          <span className="font-semibold">Subtotal:</span>
          <span className="font-semibold">{formatCurrency(result.subtotalWithMargin)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Impostos:</span>
          <span>{formatCurrency(result.totalTax)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxas/Juros:</span>
          <span>{formatCurrency(result.totalFees + result.totalInterest)}</span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span className="text-muted-foreground">Lucro líquido:</span>
          <span className={`font-semibold ${result.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
            {formatCurrency(result.netProfit)} ({formatPercent(result.realMarginRate)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Preço psicológico:</span>
          <span className="font-medium">{formatCurrency(result.psychologicalPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mín. sem prejuízo:</span>
          <span>{formatCurrency(result.minPriceNoLoss)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function ProductForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const isEditing = !!productId;

  const [form, setForm] = useState<FormState>(defaultForm);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Queries
  const productQuery = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: isEditing }
  );
  const utils = trpc.useUtils();
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); setLocation("/produtos"); toast.success("Produto criado!"); },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });
  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); setLocation("/produtos"); toast.success("Produto atualizado!"); },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const set = useCallback((field: keyof FormState) => (value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleTaxRegimeChange = useCallback((regime: TaxRegime) => {
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
  }, []);

  // Preencher formulário ao editar
  useEffect(() => {
    if (productQuery.data) {
      const p = productQuery.data;
      setForm((prev) => ({
        ...prev,
        name: p.name || "",
        shortDescription: p.shortDescription || "",
        description: p.description || "",
        category: (p.category as ProductCategory) || "CELULAR",
        categoryLabel: p.categoryLabel || "",
        ncm: p.ncm || "",
        promoTag: p.promoTag || "",
        published: p.published ?? false,
        active: p.active ?? true,
        notes: p.notes || "",
        costCurrency: (p.costCurrency as "BRL" | "USD") || "BRL",
        costPrice: p.costPrice ? String(p.costPrice) : "",
        costPriceUsd: p.costPriceUsd ? String(p.costPriceUsd) : "",
        usdExchangeRate: p.usdExchangeRate ? String(p.usdExchangeRate) : "5.50",
        packagingCost: p.packagingCost ? String(p.packagingCost) : "",
        inboundShippingCost: p.inboundShippingCost ? String(p.inboundShippingCost) : "",
        operationalCost: p.operationalCost ? String(p.operationalCost) : "",
        stockQuantity: p.stockQuantity ? String(p.stockQuantity) : "",
        minimumStock: p.minimumStock ? String(p.minimumStock) : "",
        marginMode: ((p as any).marginMode as MarginMode) || "PERCENT",
        desiredMarginRate: p.desiredMarginRate ? String(p.desiredMarginRate) : "30",
        desiredMarginValue: p.desiredMarginValue ? String(p.desiredMarginValue) : "",
        taxRegime: (p.taxRegime as TaxRegime) || "SIMPLES_NACIONAL",
        paymentPlatform: (p.paymentPlatform as PaymentPlatform) || "MERCADO_PAGO",
        pixKey: p.pixKey || "",
        pixLink: p.pixLink || "",
        cardPaymentUrl: p.cardPaymentUrl || "",
        boletoUrl: p.boletoUrl || "",
      }));
    }
  }, [productQuery.data]);

  // Custo em BRL derivado
  const costPriceBrl = useMemo(() => {
    if (form.costCurrency === "USD") return n(form.costPriceUsd) * n(form.usdExchangeRate);
    return n(form.costPrice);
  }, [form.costCurrency, form.costPrice, form.costPriceUsd, form.usdExchangeRate]);

  // Custo final unitário
  const finalUnitCost = useMemo(() => {
    return costPriceBrl + n(form.packagingCost) + n(form.inboundShippingCost) + n(form.operationalCost);
  }, [costPriceBrl, form.packagingCost, form.inboundShippingCost, form.operationalCost]);

  // Margem efetiva para o cálculo
  const effectiveMarginRate = useMemo(() => {
    if (form.marginMode === "VALUE") {
      if (finalUnitCost <= 0) return 0;
      return (n(form.desiredMarginValue) / finalUnitCost) * 100;
    }
    return n(form.desiredMarginRate);
  }, [form.marginMode, form.desiredMarginRate, form.desiredMarginValue, finalUnitCost]);

  // Calcular precificação automaticamente
  const handleCalculate = useCallback(() => {
    setCalcError(null);
    if (!form.name.trim()) { setCalcError("Informe o nome do produto."); return; }
    if (costPriceBrl <= 0) { setCalcError("Informe o preço de custo."); return; }
    const input: PricingInput = {
      productName: form.name.trim(),
      category: form.category,
      ncm: form.ncm || undefined,
      costPrice: costPriceBrl,
      packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost),
      desiredMarginRate: effectiveMarginRate,
      taxRegime: form.taxRegime,
      taxRates: {
        cash: n(form.taxCash),
        boleto: n(form.taxBoleto),
        debit: n(form.taxDebit),
        creditCash: n(form.taxCreditCash),
        creditInstallment: n(form.taxCreditInstallment),
      },
      boleto: {
        months: Math.max(1, Math.round(n(form.boletoMonths))),
        monthlyInterestRate: n(form.boletoMonthlyRate),
        fixedFee: n(form.boletoFixedFee),
        defaultRiskRate: n(form.boletoDefaultRisk),
        customerPaysInterest: form.boletoCustomerPaysInterest,
      },
      card: {
        debitFeeRate: n(form.cardDebitFee),
        creditCashFeeRate: n(form.cardCreditCashFee),
        creditInstallmentFeeRate: n(form.cardCreditInstallmentFee),
        installments: Math.max(1, Math.round(n(form.cardInstallments))),
        anticipationRate: n(form.cardAnticipationRate),
        monthlyInterestRate: n(form.cardMonthlyRate),
        customerPaysInterest: form.cardCustomerPaysInterest,
      },
    };
    const calc = calculatePricing(input);
    if (isPricingError(calc)) { setCalcError(calc.message); return; }
    setPricingResult(calc);
    setTimeout(() => document.getElementById("pricing-results")?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [form, costPriceBrl, effectiveMarginRate]);

  // Salvar produto
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }
    setIsSaving(true);

    // Preços calculados para vitrine (sem dados internos)
    const pixResult = pricingResult?.results.find(r => r.method === "PIX");
    const cardResult = pricingResult?.results.find(r => r.method === "CREDITO_A_VISTA");
    const boletoResult = pricingResult?.results.find(r => r.method === "BOLETO");
    const bestResult = pricingResult?.results.find(r => r.method === pricingResult.bestMethod);

    const payload = {
      name: form.name.trim(),
      shortDescription: form.shortDescription,
      description: form.description,
      category: form.category,
      categoryLabel: form.categoryLabel,
      ncm: form.ncm || undefined,
      promoTag: form.promoTag || undefined,
      published: form.published,
      active: form.active,
      notes: form.notes || undefined,
      costCurrency: form.costCurrency,
      costPrice: costPriceBrl,
      costPriceUsd: n(form.costPriceUsd),
      usdExchangeRate: n(form.usdExchangeRate),
      packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost),
      stockQuantity: n(form.stockQuantity),
      minimumStock: n(form.minimumStock),
      desiredMarginRate: effectiveMarginRate,
      desiredMarginValue: n(form.desiredMarginValue),
      taxRegime: form.taxRegime,
      estimatedTaxRate: n(form.taxCash),
      // Preços calculados (somente estes vão para vitrine)
      suggestedPrice: bestResult?.suggestedPrice ?? 0,
      suggestedPricePix: pixResult?.suggestedPrice ?? 0,
      suggestedPriceCard: cardResult?.suggestedPrice ?? 0,
      suggestedPriceBoleto: boletoResult?.suggestedPrice ?? 0,
      // Pagamento externo
      paymentPlatform: form.paymentPlatform,
      pixKey: form.pixKey || undefined,
      pixLink: form.pixLink || undefined,
      cardPaymentUrl: form.cardPaymentUrl || undefined,
      boletoUrl: form.boletoUrl || undefined,
    };

    if (isEditing) {
      updateProduct.mutate({ id: productId!, data: payload });
    } else {
      createProduct.mutate(payload);
    }
  }, [form, costPriceBrl, effectiveMarginRate, pricingResult, isEditing, productId, createProduct, updateProduct]);

  if (isEditing && productQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando produto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/produtos")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {isEditing ? "Editar Produto" : "Novo Produto"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Cadastre, precifique e publique na vitrine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCalculate}
            disabled={!form.name.trim() || costPriceBrl <= 0}
          >
            <Calculator className="w-4 h-4 mr-1" /> Calcular Preços
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Produto"}
          </Button>
        </div>
      </div>

      {/* ── Bloco 1: Identidade ─────────────────────────────────────────────── */}
      <SectionCard icon={<Package className="w-4 h-4" />} title="Identidade do Produto" subtitle="Nome, descrição, categoria e publicação">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FF label="Nome do produto" required>
              <Input
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Ex: Perfume Sauvage 100ml"
                className="h-9 text-sm"
              />
            </FF>
            <FF label="Categoria" required>
              <Select value={form.category} onValueChange={(v) => set("category")(v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CELULAR">Celular</SelectItem>
                  <SelectItem value="ELETRONICO">Eletrônico</SelectItem>
                  <SelectItem value="PERFUME">Perfume</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </FF>
            <FF label="Label de categoria" tooltip="Texto exibido como filtro na vitrine">
              <Input value={form.categoryLabel} onChange={(e) => set("categoryLabel")(e.target.value)} placeholder="Ex: Fragrâncias" className="h-9 text-sm" />
            </FF>
            <FF label="NCM" tooltip="Nomenclatura Comum do Mercosul — código fiscal do produto">
              <Input value={form.ncm} onChange={(e) => set("ncm")(e.target.value)} placeholder="0000.00.00" className="h-9 text-sm" />
            </FF>
            <FF label="Tag de promoção" tooltip="Ex: NOVO, OFERTA, -20%">
              <Input value={form.promoTag} onChange={(e) => set("promoTag")(e.target.value)} placeholder="Ex: OFERTA" className="h-9 text-sm" />
            </FF>
          </div>
          <FF label="Descrição curta" tooltip="Exibida nos cards da vitrine">
            <Input value={form.shortDescription} onChange={(e) => set("shortDescription")(e.target.value)} placeholder="Resumo em até 120 caracteres" className="h-9 text-sm" />
          </FF>
          <FF label="Descrição completa">
            <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="Descrição detalhada do produto..." rows={3} className="text-sm resize-none" />
          </FF>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              {form.published ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{form.published ? "Publicado na vitrine" : "Não publicado"}</p>
                <p className="text-xs text-muted-foreground">Controla a visibilidade pública do produto</p>
              </div>
            </div>
            <Switch checked={form.published} onCheckedChange={(v) => set("published")(v)} />
          </div>
          {/* Galeria de imagens */}
          <div>
            <p className="text-xs font-medium text-foreground/80 mb-2">Galeria de imagens</p>
            {isEditing && productId ? (
              <ImageGallery productId={productId} />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Salve o produto primeiro para adicionar imagens
              </div>
            )}
          </div>
          <FF label="Observações internas">
            <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Notas internas (não aparecem na vitrine)" rows={2} className="text-sm resize-none" />
          </FF>
        </div>
      </SectionCard>

      {/* ── Bloco 2: Custos e Estoque ───────────────────────────────────────── */}
      <SectionCard icon={<DollarSign className="w-4 h-4" />} title="Custos e Estoque" subtitle="Custo do produto, embalagem, frete e controle de estoque">
        <div className="space-y-5">
          {/* Moeda */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">Moeda do custo:</span>
            <div className="flex gap-2">
              {(["BRL", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("costCurrency")(c)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    form.costCurrency === c ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {form.costCurrency === "BRL" ? (
              <FF label="Preço de custo (BRL)" required>
                <NI value={form.costPrice} onChange={set("costPrice")} prefix="R$" placeholder="0,00" />
              </FF>
            ) : (
              <>
                <FF label="Preço de custo (USD)" required>
                  <NI value={form.costPriceUsd} onChange={set("costPriceUsd")} prefix="$" placeholder="0,00" />
                </FF>
                <FF label="Cotação do dólar" required>
                  <NI value={form.usdExchangeRate} onChange={set("usdExchangeRate")} prefix="R$" placeholder="5,50" />
                </FF>
              </>
            )}
            <FF label="Custo de embalagem">
              <NI value={form.packagingCost} onChange={set("packagingCost")} prefix="R$" placeholder="0,00" />
            </FF>
            <FF label="Frete de entrada">
              <NI value={form.inboundShippingCost} onChange={set("inboundShippingCost")} prefix="R$" placeholder="0,00" />
            </FF>
            <FF label="Custo operacional">
              <NI value={form.operationalCost} onChange={set("operationalCost")} prefix="R$" placeholder="0,00" />
            </FF>
            <FF label="Estoque atual">
              <NI value={form.stockQuantity} onChange={set("stockQuantity")} placeholder="0" />
            </FF>
            <FF label="Estoque mínimo">
              <NI value={form.minimumStock} onChange={set("minimumStock")} placeholder="0" />
            </FF>
          </div>
          {/* Resumo de custo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/30">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Custo em BRL</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100 tabular-nums">{formatCurrency(costPriceBrl)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800/30">
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Custo Final Unitário</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100 tabular-nums">{formatCurrency(finalUnitCost)}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Bloco 3: Margem ─────────────────────────────────────────────────── */}
      <SectionCard icon={<Percent className="w-4 h-4" />} title="Margem de Lucro" subtitle="Define o lucro desejado antes de impostos e taxas">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">Modo de margem:</span>
            <div className="flex gap-2">
              {([["PERCENT", "Porcentagem (%)"], ["VALUE", "Valor fixo (R$)"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("marginMode")(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    form.marginMode === mode ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FF label="Margem desejada (%)" tooltip="Percentual de lucro sobre o custo base. Ex: 50% = lucro de 50% sobre o custo.">
              <NI
                value={form.desiredMarginRate}
                onChange={set("desiredMarginRate")}
                suffix="%"
                placeholder="30"
                disabled={form.marginMode === "VALUE"}
              />
            </FF>
            <FF label="Margem em valor (R$)" tooltip="Valor fixo de lucro desejado. Usado apenas no modo Valor fixo.">
              <NI
                value={form.desiredMarginValue}
                onChange={set("desiredMarginValue")}
                prefix="R$"
                placeholder="0,00"
                disabled={form.marginMode === "PERCENT"}
              />
            </FF>
          </div>
          {form.marginMode === "VALUE" && finalUnitCost > 0 && n(form.desiredMarginValue) > 0 && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30">
              <p className="text-xs text-purple-700 dark:text-purple-300">
                Equivalente a <strong>{formatPercent(effectiveMarginRate)}</strong> de margem sobre o custo base de {formatCurrency(finalUnitCost)}
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Bloco 4: Fiscal ─────────────────────────────────────────────────── */}
      <SectionCard icon={<AlertTriangle className="w-4 h-4" />} title="Configuração Fiscal" subtitle="Regime tributário e alíquotas por forma de pagamento">
        <div className="space-y-4">
          <div className="flex gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">
              <strong>Aviso fiscal:</strong> Alíquotas sugeridas automaticamente. Confirme NCM, regime tributário e CST/CSOSN com seu contador.
            </p>
          </div>
          <FF label="Regime tributário">
            <Select value={form.taxRegime} onValueChange={(v) => handleTaxRegimeChange(v as TaxRegime)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TAX_REGIME_LABELS) as TaxRegime[]).map((key) => (
                  <SelectItem key={key} value={key}>{TAX_REGIME_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FF>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Pix / À Vista", field: "taxCash" as const },
              { label: "Boleto", field: "taxBoleto" as const },
              { label: "Débito", field: "taxDebit" as const },
              { label: "Crédito à Vista", field: "taxCreditCash" as const },
              { label: "Crédito Parcelado", field: "taxCreditInstallment" as const },
            ].map(({ label, field }) => (
              <FF key={field} label={label}>
                <NI value={form[field]} onChange={set(field)} suffix="%" placeholder="6" />
              </FF>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Bloco 5: Boleto ─────────────────────────────────────────────────── */}
      <SectionCard icon={<Banknote className="w-4 h-4" />} title="Configuração de Boleto" subtitle="Parcelamento, juros e inadimplência">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FF label="Parcelas" tooltip="Número de parcelas do boleto parcelado">
              <NI value={form.boletoMonths} onChange={set("boletoMonths")} placeholder="3" />
            </FF>
            <FF label="Juros mensal" tooltip="Taxa de juros ao mês aplicada ao boleto parcelado">
              <NI value={form.boletoMonthlyRate} onChange={set("boletoMonthlyRate")} suffix="%" placeholder="1,99" />
            </FF>
            <FF label="Taxa fixa de emissão" tooltip="Custo fixo por boleto emitido (padrão R$ 3,50)">
              <NI value={form.boletoFixedFee} onChange={set("boletoFixedFee")} prefix="R$" placeholder="3,50" />
            </FF>
            <FF label="Risco de inadimplência" tooltip="Percentual de perda estimado por inadimplência">
              <NI value={form.boletoDefaultRisk} onChange={set("boletoDefaultRisk")} suffix="%" placeholder="2" />
            </FF>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div>
              <p className="text-sm font-medium">Juros repassado ao cliente</p>
              <p className="text-xs text-muted-foreground">Se desligado, a empresa absorve os juros no preço</p>
            </div>
            <Switch checked={form.boletoCustomerPaysInterest} onCheckedChange={(v) => set("boletoCustomerPaysInterest")(v)} />
          </div>
        </div>
      </SectionCard>

      {/* ── Bloco 6: Cartão ─────────────────────────────────────────────────── */}
      <SectionCard icon={<CreditCard className="w-4 h-4" />} title="Configuração de Cartão" subtitle="Taxas de débito, crédito e antecipação">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FF label="Taxa débito">
              <NI value={form.cardDebitFee} onChange={set("cardDebitFee")} suffix="%" placeholder="1,5" />
            </FF>
            <FF label="Taxa crédito à vista">
              <NI value={form.cardCreditCashFee} onChange={set("cardCreditCashFee")} suffix="%" placeholder="2,5" />
            </FF>
            <FF label="Taxa crédito parcelado">
              <NI value={form.cardCreditInstallmentFee} onChange={set("cardCreditInstallmentFee")} suffix="%" placeholder="3,5" />
            </FF>
            <FF label="Parcelas">
              <NI value={form.cardInstallments} onChange={set("cardInstallments")} placeholder="6" />
            </FF>
            <FF label="Taxa de antecipação">
              <NI value={form.cardAnticipationRate} onChange={set("cardAnticipationRate")} suffix="%" placeholder="1,5" />
            </FF>
            <FF label="Juros mensal">
              <NI value={form.cardMonthlyRate} onChange={set("cardMonthlyRate")} suffix="%" placeholder="1,99" />
            </FF>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div>
              <p className="text-sm font-medium">Juros repassado ao cliente</p>
              <p className="text-xs text-muted-foreground">Se desligado, a empresa absorve os juros no preço</p>
            </div>
            <Switch checked={form.cardCustomerPaysInterest} onCheckedChange={(v) => set("cardCustomerPaysInterest")(v)} />
          </div>
        </div>
      </SectionCard>

      {/* ── Bloco 7: Calcular e Cards de Resultado ──────────────────────────── */}
      <div id="pricing-results">
        {calcError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {calcError}
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Resultado da Precificação</h2>
            <p className="text-xs text-muted-foreground">Clique em "Calcular Preços" para ver os valores por forma de pagamento</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCalculate} disabled={!form.name.trim() || costPriceBrl <= 0}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Recalcular
          </Button>
        </div>

        {pricingResult ? (
          <div className="space-y-4">
            {pricingResult.hasUnhealthyProduct && pricingResult.unhealthyAlert && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {pricingResult.unhealthyAlert}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pricingResult.results.map((r) => (
                <ResultCard
                  key={r.method}
                  result={r}
                  isBest={r.method === pricingResult.bestMethod}
                  isWorst={r.method === pricingResult.worstMethod}
                />
              ))}
            </div>

            {/* Oferta comercial para vitrine */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Oferta Comercial — O que aparece na vitrine
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "PIX / À Vista", value: pricingResult.results.find(r => r.method === "PIX")?.suggestedPrice },
                    { label: "Débito", value: pricingResult.results.find(r => r.method === "DEBITO")?.suggestedPrice },
                    { label: "Crédito à Vista", value: pricingResult.results.find(r => r.method === "CREDITO_A_VISTA")?.suggestedPrice },
                    { label: "Crédito Parcelado", value: pricingResult.results.find(r => r.method === "CREDITO_PARCELADO") },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-background border">
                      <p className="text-muted-foreground mb-1">{item.label}</p>
                      {typeof item.value === "number" ? (
                        <p className="font-bold text-foreground">{formatCurrency(item.value)}</p>
                      ) : item.value && typeof item.value === "object" ? (
                        <div>
                          <p className="font-bold text-foreground">{formatCurrency((item.value as PaymentResult).suggestedPrice)}</p>
                          <p className="text-muted-foreground">{(item.value as PaymentResult).installments}x de {formatCurrency((item.value as PaymentResult).installmentValue)}</p>
                        </div>
                      ) : <p className="text-muted-foreground">—</p>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-background border">
                  <p className="text-xs text-muted-foreground mb-1">Boleto parcelado</p>
                  {(() => {
                    const b = pricingResult.results.find(r => r.method === "BOLETO");
                    if (!b) return <p className="text-xs text-muted-foreground">—</p>;
                    return (
                      <p className="text-xs font-medium">
                        Entrada de {formatCurrency(b.suggestedPrice / (b.installments + 1))} + {b.installments}x de {formatCurrency(b.installmentValue)}
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Calculator className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Preencha os custos e clique em <strong>Calcular Preços</strong></p>
          </div>
        )}
      </div>

      {/* ── Bloco 8: Links de Pagamento ─────────────────────────────────────── */}
      <SectionCard icon={<Sparkles className="w-4 h-4" />} title="Links de Pagamento" subtitle="URLs externas para PIX, cartão e boleto na vitrine">
        <div className="space-y-4">
          <FF label="Plataforma de pagamento">
            <Select value={form.paymentPlatform} onValueChange={(v) => set("paymentPlatform")(v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                <SelectItem value="PAGSEGURO">PagSeguro</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </FF>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FF label="Chave PIX">
              <Input value={form.pixKey} onChange={(e) => set("pixKey")(e.target.value)} placeholder="CPF, CNPJ, e-mail ou chave aleatória" className="h-9 text-sm" />
            </FF>
            <FF label="Link de pagamento PIX">
              <Input value={form.pixLink} onChange={(e) => set("pixLink")(e.target.value)} placeholder="https://..." className="h-9 text-sm" />
            </FF>
            <FF label="Link de pagamento Cartão">
              <Input value={form.cardPaymentUrl} onChange={(e) => set("cardPaymentUrl")(e.target.value)} placeholder="https://..." className="h-9 text-sm" />
            </FF>
            <FF label="Link de pagamento Boleto">
              <Input value={form.boletoUrl} onChange={(e) => set("boletoUrl")(e.target.value)} placeholder="https://..." className="h-9 text-sm" />
            </FF>
          </div>
        </div>
      </SectionCard>

      {/* Botão salvar final */}
      <div className="flex justify-end gap-3 pt-2 pb-8">
        <Button variant="outline" onClick={() => setLocation("/produtos")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Produto"}
        </Button>
      </div>
    </div>
  );
}
