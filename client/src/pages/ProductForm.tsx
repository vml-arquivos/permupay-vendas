/**
 * ProductForm.tsx — Cadastro + Simulador Unificado "Silent Wealth"
 * Layout: formulário à esquerda (abas) + painel escuro sticky à direita (simulador).
 * REGRA: toda a lógica de cálculo, salvamento e hooks é PRESERVADA do original.
 * Apenas o layout e estilo foram refatorados.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  calculatePricing, isPricingError, SUGGESTED_TAX_RATES, TAX_REGIME_LABELS,
  PAYMENT_METHOD_LABELS, formatCurrency, formatPercent,
  type PricingInput, type PricingResult, type PaymentResult,
  type ProductCategory, type TaxRegime, type PaymentMethod,
} from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info, Calculator,
  Package, DollarSign, Percent, CreditCard, Banknote, Sparkles, Tag,
  Eye, EyeOff, Save, ArrowLeft, TrendingUp, TrendingDown, RefreshCcw,
  Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type MarginMode = "PERCENT" | "VALUE";
type PaymentPlatform = "MERCADO_PAGO" | "PAGSEGURO" | "OUTRO";
type Tab = "setup" | "custos" | "taxas" | "links";

interface FormState {
  name: string; shortDescription: string; description: string;
  category: ProductCategory; categoryLabel: string; ncm: string;
  promoTag: string; published: boolean; active: boolean; notes: string;
  costCurrency: "BRL" | "USD"; costPrice: string; costPriceUsd: string;
  usdExchangeRate: string; packagingCost: string; inboundShippingCost: string;
  operationalCost: string; stockQuantity: string; minimumStock: string;
  marginMode: MarginMode; desiredMarginRate: string; desiredMarginValue: string;
  taxRegime: TaxRegime; taxCash: string; taxBoleto: string; taxDebit: string;
  taxCreditCash: string; taxCreditInstallment: string;
  boletoMonths: string; boletoMonthlyRate: string; boletoFixedFee: string;
  boletoDefaultRisk: string; boletoCustomerPaysInterest: boolean;
  cardDebitFee: string; cardCreditCashFee: string; cardCreditInstallmentFee: string;
  cardInstallments: string; cardAnticipationRate: string; cardMonthlyRate: string;
  cardCustomerPaysInterest: boolean;
  paymentPlatform: PaymentPlatform; pixKey: string; pixLink: string;
  cardPaymentUrl: string; boletoUrl: string;
}

const defaultForm: FormState = {
  name: "", shortDescription: "", description: "", category: "CELULAR",
  categoryLabel: "", ncm: "", promoTag: "", published: false, active: true, notes: "",
  costCurrency: "BRL", costPrice: "", costPriceUsd: "", usdExchangeRate: "5.50",
  packagingCost: "", inboundShippingCost: "", operationalCost: "",
  stockQuantity: "", minimumStock: "", marginMode: "PERCENT",
  desiredMarginRate: "30", desiredMarginValue: "",
  taxRegime: "SIMPLES_NACIONAL", taxCash: "6", taxBoleto: "6", taxDebit: "6",
  taxCreditCash: "6", taxCreditInstallment: "6",
  boletoMonths: "3", boletoMonthlyRate: "1.99", boletoFixedFee: "3.50",
  boletoDefaultRisk: "2", boletoCustomerPaysInterest: false,
  cardDebitFee: "1.5", cardCreditCashFee: "2.5", cardCreditInstallmentFee: "3.5",
  cardInstallments: "6", cardAnticipationRate: "1.5", cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
  paymentPlatform: "MERCADO_PAGO", pixKey: "", pixLink: "", cardPaymentUrl: "", boletoUrl: "",
};

function n(val: string): number {
  if (!val) return 0;
  const v = parseFloat(val.replace(",", "."));
  return isNaN(v) ? 0 : v;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Campo de formulário com label e tooltip opcionais */
function Field({ label, tooltip, required, children, className = "" }: {
  label: string; tooltip?: string; required?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Label className="text-[11px] font-medium text-neutral-600 tracking-wide">
          {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-neutral-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs bg-neutral-900 text-white border-0">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

/** Input numérico com prefixo/sufixo */
function NumInput({ value, onChange, placeholder, prefix, suffix, disabled }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; disabled?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-[11px] text-neutral-400 pointer-events-none">{prefix}</span>}
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"} step="any" min={0} disabled={disabled}
        className={`h-9 text-sm border-neutral-200 bg-white focus:border-neutral-400 focus:ring-0 focus-visible:ring-0 ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      />
      {suffix && <span className="absolute right-3 text-[11px] text-neutral-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

/** Tab button */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase transition-all whitespace-nowrap border-b-2 ${
        active ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-700"
      }`}>
      {children}
    </button>
  );
}

/** Seção collapsível dentro do formulário */
function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-neutral-100 rounded-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50/60 hover:bg-neutral-50 transition-colors text-left">
        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-600">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />}
      </button>
      {open && <div className="p-4 space-y-4 bg-white">{children}</div>}
    </div>
  );
}

/** Card de resultado de precificação no painel escuro */
function DarkResultCard({ result, isBest, isWorst }: { result: PaymentResult; isBest: boolean; isWorst: boolean }) {
  const statusColor = {
    EXCELENTE: "text-emerald-400", SAUDAVEL: "text-green-400", ATENCAO: "text-amber-400",
    RISCO: "text-orange-400", PREJUIZO: "text-red-400",
  }[(result as any).diagnostic] || "text-neutral-400";

  return (
    <div className={`rounded-sm p-3.5 transition-all ${
      isBest ? "bg-white/10 ring-1 ring-white/20" : "bg-white/5"
    }`}>
      {isBest && (
        <span className="inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.2em] uppercase text-emerald-400 mb-2">
          <TrendingUp className="w-2.5 h-2.5" /> Melhor opção
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold text-white/70 tracking-wide">{result.methodLabel}</p>
          {result.installments > 1 && (
            <p className="text-[9px] text-white/40">{result.installments}× {formatCurrency(result.installmentValue)}</p>
          )}
        </div>
        <span className={`text-[9px] font-bold ${statusColor}`}>{(result as any).diagnostic}</span>
      </div>
      <p className="text-xl font-semibold text-white tracking-tight">{formatCurrency(result.suggestedPrice)}</p>
      <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-white/50">Lucro líquido</span>
          <span className={`font-semibold ${result.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(result.netProfit)} ({formatPercent(result.realMarginRate)})
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-white/40">Preço psicológico</span>
          <span className="text-white/60">{formatCurrency(result.psychologicalPrice)}</span>
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
  const [activeTab, setActiveTab] = useState<Tab>("setup");

  // ── Queries & Mutations ────────────────────────────────────────────────────
  const productQuery = trpc.products.byId.useQuery({ id: productId! }, { enabled: isEditing });
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
      ...prev, taxRegime: regime,
      taxCash: String(rates.cash), taxBoleto: String(rates.boleto),
      taxDebit: String(rates.debit), taxCreditCash: String(rates.creditCash),
      taxCreditInstallment: String(rates.creditInstallment),
    }));
  }, []);

  // Popular form ao editar
  useEffect(() => {
    if (productQuery.data) {
      const p = productQuery.data;
      setForm((prev) => ({
        ...prev,
        name: p.name || "", shortDescription: p.shortDescription || "",
        description: p.description || "", category: (p.category as ProductCategory) || "CELULAR",
        categoryLabel: p.categoryLabel || "", ncm: p.ncm || "", promoTag: p.promoTag || "",
        published: p.published ?? false, active: p.active ?? true, notes: p.notes || "",
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
        taxCash: (p as any).taxCash != null ? String((p as any).taxCash) : "6",
        taxBoleto: (p as any).taxBoleto != null ? String((p as any).taxBoleto) : "6",
        taxDebit: (p as any).taxDebit != null ? String((p as any).taxDebit) : "6",
        taxCreditCash: (p as any).taxCreditCash != null ? String((p as any).taxCreditCash) : "6",
        taxCreditInstallment: (p as any).taxCreditInstallment != null ? String((p as any).taxCreditInstallment) : "6",
        boletoMonths: (p as any).boletoMonths != null ? String((p as any).boletoMonths) : "3",
        boletoMonthlyRate: (p as any).boletoMonthlyRate != null ? String((p as any).boletoMonthlyRate) : "1.99",
        boletoFixedFee: (p as any).boletoFixedFee != null ? String((p as any).boletoFixedFee) : "3.50",
        boletoDefaultRisk: (p as any).boletoDefaultRisk != null ? String((p as any).boletoDefaultRisk) : "2",
        boletoCustomerPaysInterest: (p as any).boletoCustomerPaysInterest ?? false,
        cardDebitFee: (p as any).cardDebitFee != null ? String((p as any).cardDebitFee) : "1.5",
        cardCreditCashFee: (p as any).cardCreditCashFee != null ? String((p as any).cardCreditCashFee) : "2.5",
        cardCreditInstallmentFee: (p as any).cardCreditInstallmentFee != null ? String((p as any).cardCreditInstallmentFee) : "3.5",
        cardInstallments: (p as any).cardInstallments != null ? String((p as any).cardInstallments) : "6",
        cardAnticipationRate: (p as any).cardAnticipationRate != null ? String((p as any).cardAnticipationRate) : "1.5",
        cardMonthlyRate: (p as any).cardMonthlyRate != null ? String((p as any).cardMonthlyRate) : "1.99",
        cardCustomerPaysInterest: (p as any).cardCustomerPaysInterest ?? false,
        paymentPlatform: (p.paymentPlatform as PaymentPlatform) || "OUTRO",
        pixKey: p.pixKey || "", pixLink: p.pixLink || "",
        cardPaymentUrl: p.cardPaymentUrl || "", boletoUrl: p.boletoUrl || "",
      }));
    }
  }, [productQuery.data]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const costPriceBrl = useMemo(() => {
    if (form.costCurrency === "USD") return n(form.costPriceUsd) * n(form.usdExchangeRate);
    return n(form.costPrice);
  }, [form.costCurrency, form.costPrice, form.costPriceUsd, form.usdExchangeRate]);

  const finalUnitCost = useMemo(() =>
    costPriceBrl + n(form.packagingCost) + n(form.inboundShippingCost) + n(form.operationalCost),
    [costPriceBrl, form.packagingCost, form.inboundShippingCost, form.operationalCost]);

  const effectiveMarginRate = useMemo(() => {
    if (form.marginMode === "VALUE") {
      if (finalUnitCost <= 0) return 0;
      return (n(form.desiredMarginValue) / finalUnitCost) * 100;
    }
    return n(form.desiredMarginRate);
  }, [form.marginMode, form.desiredMarginRate, form.desiredMarginValue, finalUnitCost]);

  // ── Calcular ──────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    setCalcError(null);
    if (!form.name.trim()) { setCalcError("Informe o nome do produto."); return; }
    if (costPriceBrl <= 0) { setCalcError("Informe o preço de custo."); return; }
    const input: PricingInput = {
      productName: form.name.trim(), category: form.category, ncm: form.ncm || undefined,
      costPrice: costPriceBrl, packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost), operationalCost: n(form.operationalCost),
      desiredMarginRate: effectiveMarginRate, taxRegime: form.taxRegime,
      taxRates: { cash: n(form.taxCash), boleto: n(form.taxBoleto), debit: n(form.taxDebit), creditCash: n(form.taxCreditCash), creditInstallment: n(form.taxCreditInstallment) },
      boleto: { months: Math.max(1, Math.round(n(form.boletoMonths))), monthlyInterestRate: n(form.boletoMonthlyRate), fixedFee: n(form.boletoFixedFee), defaultRiskRate: n(form.boletoDefaultRisk), customerPaysInterest: form.boletoCustomerPaysInterest },
      card: { debitFeeRate: n(form.cardDebitFee), creditCashFeeRate: n(form.cardCreditCashFee), creditInstallmentFeeRate: n(form.cardCreditInstallmentFee), installments: Math.max(1, Math.round(n(form.cardInstallments))), anticipationRate: n(form.cardAnticipationRate), monthlyInterestRate: n(form.cardMonthlyRate), customerPaysInterest: form.cardCustomerPaysInterest },
    };
    const calc = calculatePricing(input);
    if (isPricingError(calc)) { setCalcError(calc.message); return; }
    setPricingResult(calc);
  }, [form, costPriceBrl, effectiveMarginRate]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }
    setIsSaving(true);
    const pixResult    = pricingResult?.results.find(r => r.method === "PIX");
    const cardResult   = pricingResult?.results.find(r => r.method === "CREDITO_A_VISTA");
    const boletoResult = pricingResult?.results.find(r => r.method === "BOLETO");
    const bestResult   = pricingResult?.results.find(r => r.method === pricingResult.bestMethod);
    const payload = {
      name: form.name.trim(), shortDescription: form.shortDescription,
      description: form.description, category: form.category, categoryLabel: form.categoryLabel,
      ncm: form.ncm || undefined, promoTag: form.promoTag || undefined,
      published: form.published, active: form.active, notes: form.notes || undefined,
      costCurrency: form.costCurrency, costPrice: costPriceBrl,
      costPriceUsd: n(form.costPriceUsd), usdExchangeRate: n(form.usdExchangeRate),
      packagingCost: n(form.packagingCost), inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost), stockQuantity: n(form.stockQuantity),
      minimumStock: n(form.minimumStock), desiredMarginRate: effectiveMarginRate,
      desiredMarginValue: n(form.desiredMarginValue), taxRegime: form.taxRegime,
      estimatedTaxRate: n(form.taxCash),
      suggestedPrice: bestResult?.suggestedPrice ?? 0,
      suggestedPricePix: pixResult?.suggestedPrice ?? 0,
      suggestedPriceCard: cardResult?.suggestedPrice ?? 0,
      suggestedPriceBoleto: boletoResult?.suggestedPrice ?? 0,
      taxCash: n(form.taxCash), taxBoleto: n(form.taxBoleto), taxDebit: n(form.taxDebit),
      taxCreditCash: n(form.taxCreditCash), taxCreditInstallment: n(form.taxCreditInstallment),
      boletoMonths: n(form.boletoMonths), boletoMonthlyRate: n(form.boletoMonthlyRate),
      boletoFixedFee: n(form.boletoFixedFee), boletoDefaultRisk: n(form.boletoDefaultRisk),
      boletoCustomerPaysInterest: form.boletoCustomerPaysInterest,
      cardDebitFee: n(form.cardDebitFee), cardCreditCashFee: n(form.cardCreditCashFee),
      cardCreditInstallmentFee: n(form.cardCreditInstallmentFee), cardInstallments: n(form.cardInstallments),
      cardAnticipationRate: n(form.cardAnticipationRate), cardMonthlyRate: n(form.cardMonthlyRate),
      cardCustomerPaysInterest: form.cardCustomerPaysInterest,
      paymentPlatform: form.paymentPlatform,
      pixKey: form.pixKey || undefined, pixLink: form.pixLink || undefined,
      cardPaymentUrl: form.cardPaymentUrl || undefined, boletoUrl: form.boletoUrl || undefined,
      marginMode: form.marginMode,
    };
    if (isEditing) { updateProduct.mutate({ id: productId!, data: payload }); }
    else { createProduct.mutate(payload); }
  }, [form, costPriceBrl, effectiveMarginRate, pricingResult, isEditing, productId, createProduct, updateProduct]);

  if (isEditing && productQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-neutral-400">Carregando produto...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto space-y-0">

        {/* ── Topbar da página ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => setLocation("/produtos")}
              className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors tracking-wide">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">
                {isEditing ? "Editar Produto" : "Novo Produto"}
              </h1>
              <p className="text-[11px] text-neutral-400 mt-0.5">Cadastro, precificação e publicação na vitrine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <a href={`/vitrine/${productId}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] uppercase px-3 py-2 border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-800 transition-colors">
                <Eye className="w-3 h-3" /> Ver na Vitrine
              </a>
            )}
            <button onClick={handleCalculate}
              disabled={!form.name.trim() || costPriceBrl <= 0}
              className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] uppercase px-3 py-2 border border-neutral-300 text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <Calculator className="w-3 h-3" /> Calcular Preços
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
              <Save className="w-3 h-3" />
              {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Produto"}
            </button>
          </div>
        </div>

        {/* ── Grid principal: formulário + painel dark ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 items-start">

          {/* ── LADO ESQUERDO: formulário em abas ────────────────────── */}
          <div className="border border-neutral-100 bg-white">

            {/* Tabs */}
            <div className="border-b border-neutral-100 flex overflow-x-auto no-scrollbar px-2">
              <TabBtn active={activeTab === "setup"}  onClick={() => setActiveTab("setup")}>Identidade</TabBtn>
              <TabBtn active={activeTab === "custos"} onClick={() => setActiveTab("custos")}>Custos & Estoque</TabBtn>
              <TabBtn active={activeTab === "taxas"}  onClick={() => setActiveTab("taxas")}>Taxas & Gateway</TabBtn>
              <TabBtn active={activeTab === "links"}  onClick={() => setActiveTab("links")}>Links de Pagamento</TabBtn>
            </div>

            {/* ── ABA 1: IDENTIDADE ──────────────────────────────────── */}
            {activeTab === "setup" && (
              <div className="p-6 space-y-5">
                <Section title="Informações Básicas">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nome do produto" required className="sm:col-span-2">
                      <Input value={form.name} onChange={(e) => set("name")(e.target.value)}
                        placeholder="Ex: Sauvage Eau de Parfum 100ml"
                        className="h-9 text-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="Categoria" required>
                      <Select value={form.category} onValueChange={(v) => set("category")(v)}>
                        <SelectTrigger className="h-9 text-sm border-neutral-200 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"] as ProductCategory[]).map((c) => (
                            <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Label de categoria" tooltip="Exibida na vitrine (ex: Perfumes Importados)">
                      <Input value={form.categoryLabel} onChange={(e) => set("categoryLabel")(e.target.value)}
                        placeholder="Ex: Perfumes Importados"
                        className="h-9 text-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="NCM">
                      <Input value={form.ncm} onChange={(e) => set("ncm")(e.target.value)}
                        placeholder="Ex: 3303.00.10"
                        className="h-9 text-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="Tag de promoção" tooltip='Ex: "OFERTA", "LANÇAMENTO"'>
                      <Input value={form.promoTag} onChange={(e) => set("promoTag")(e.target.value)}
                        placeholder="Ex: OFERTA"
                        className="h-9 text-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                  </div>
                </Section>

                <Section title="Descrição">
                  <Field label="Descrição curta" tooltip="Aparece nos cards da vitrine (máx. 120 caracteres)">
                    <Input value={form.shortDescription} onChange={(e) => set("shortDescription")(e.target.value)}
                      placeholder="Breve descrição atrativa"
                      className="h-9 text-sm border-neutral-200 focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" maxLength={120} />
                  </Field>
                  <Field label="Descrição completa">
                    <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)}
                      placeholder="Descrição detalhada do produto..."
                      rows={5} className="text-sm border-neutral-200 resize-none focus:border-neutral-400 focus:ring-0 focus-visible:ring-0" />
                  </Field>
                </Section>

                <Section title="Publicação">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm">
                    <div>
                      <p className="text-[12px] font-medium text-neutral-800">Publicado na vitrine</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Produto visível ao público</p>
                    </div>
                    <Switch checked={form.published} onCheckedChange={(v) => set("published")(v)} />
                  </div>
                </Section>

                {isEditing && productId ? (
                  <Section title="Galeria de Imagens">
                    <ImageGallery productId={productId} />
                  </Section>
                ) : (
                  <div className="border border-dashed border-neutral-200 rounded-sm p-6 text-center">
                    <p className="text-[11px] text-neutral-400">Salve o produto primeiro para adicionar imagens</p>
                  </div>
                )}

                <Section title="Observações internas" defaultOpen={false}>
                  <Field label="Notas (não aparecem na vitrine)">
                    <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)}
                      placeholder="Notas internas..."
                      rows={3} className="text-sm border-neutral-200 resize-none focus:ring-0 focus-visible:ring-0" />
                  </Field>
                </Section>
              </div>
            )}

            {/* ── ABA 2: CUSTOS & ESTOQUE ────────────────────────────── */}
            {activeTab === "custos" && (
              <div className="p-6 space-y-5">
                <Section title="Custo do Produto">
                  {/* Seletor de moeda */}
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-sm">
                    <span className="text-[11px] font-medium text-neutral-500">Moeda:</span>
                    <div className="flex gap-1.5">
                      {(["BRL", "USD"] as const).map((c) => (
                        <button key={c} onClick={() => set("costCurrency")(c)}
                          className={`px-3 py-1 text-[10px] font-bold tracking-wide transition-colors ${
                            form.costCurrency === c
                              ? "bg-neutral-900 text-white"
                              : "bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-400"
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {form.costCurrency === "BRL" ? (
                      <Field label="Preço de custo (R$)" required>
                        <NumInput value={form.costPrice} onChange={set("costPrice")} prefix="R$" placeholder="0,00" />
                      </Field>
                    ) : (
                      <>
                        <Field label="Preço em dólar (US$)" required>
                          <NumInput value={form.costPriceUsd} onChange={set("costPriceUsd")} prefix="US$" placeholder="0,00" />
                        </Field>
                        <Field label="Cotação do dólar" tooltip="Dólar comercial do dia">
                          <NumInput value={form.usdExchangeRate} onChange={set("usdExchangeRate")} prefix="R$" placeholder="5.50" />
                        </Field>
                        <Field label="Custo em R$ (calculado)" disabled>
                          <NumInput value={costPriceBrl > 0 ? costPriceBrl.toFixed(2) : ""} onChange={() => {}} prefix="R$" disabled />
                        </Field>
                      </>
                    )}
                    <Field label="Custo de embalagem">
                      <NumInput value={form.packagingCost} onChange={set("packagingCost")} prefix="R$" placeholder="0,00" />
                    </Field>
                    <Field label="Frete de entrada">
                      <NumInput value={form.inboundShippingCost} onChange={set("inboundShippingCost")} prefix="R$" placeholder="0,00" />
                    </Field>
                    <Field label="Custo operacional">
                      <NumInput value={form.operationalCost} onChange={set("operationalCost")} prefix="R$" placeholder="0,00" />
                    </Field>
                  </div>

                  {/* Resumo de custo */}
                  {finalUnitCost > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="p-3 bg-neutral-50 rounded-sm">
                        <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-neutral-400 mb-1">Custo em BRL</p>
                        <p className="text-base font-semibold text-neutral-900">{formatCurrency(costPriceBrl)}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-sm">
                        <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-emerald-600 mb-1">Custo Final Unitário</p>
                        <p className="text-base font-semibold text-emerald-800">{formatCurrency(finalUnitCost)}</p>
                      </div>
                    </div>
                  )}
                </Section>

                <Section title="Estoque">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Estoque atual">
                      <NumInput value={form.stockQuantity} onChange={set("stockQuantity")} placeholder="0" />
                    </Field>
                    <Field label="Estoque mínimo" tooltip="Alerta de reposição">
                      <NumInput value={form.minimumStock} onChange={set("minimumStock")} placeholder="0" />
                    </Field>
                  </div>
                </Section>

                <Section title="Margem de Lucro Desejada">
                  <div className="flex gap-1.5 mb-4">
                    {(["PERCENT", "VALUE"] as const).map((m) => (
                      <button key={m} onClick={() => set("marginMode")(m)}
                        className={`px-4 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                          form.marginMode === m ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-500"
                        }`}>
                        {m === "PERCENT" ? "Porcentagem (%)" : "Valor (R$)"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {form.marginMode === "PERCENT" ? (
                      <Field label="Margem desejada (%)" required>
                        <NumInput value={form.desiredMarginRate} onChange={set("desiredMarginRate")} suffix="%" placeholder="30" />
                      </Field>
                    ) : (
                      <Field label="Margem em valor (R$)" required>
                        <NumInput value={form.desiredMarginValue} onChange={set("desiredMarginValue")} prefix="R$" placeholder="0,00" />
                      </Field>
                    )}
                    <Field label="Margem efetiva" disabled>
                      <NumInput value={effectiveMarginRate.toFixed(2)} onChange={() => {}} suffix="%" disabled />
                    </Field>
                  </div>
                  {effectiveMarginRate > 0 && finalUnitCost > 0 && (
                    <p className="text-[10px] text-neutral-500 mt-2">
                      Equivale a {formatPercent(effectiveMarginRate)} sobre custo de {formatCurrency(finalUnitCost)}
                    </p>
                  )}
                </Section>
              </div>
            )}

            {/* ── ABA 3: TAXAS & GATEWAY ─────────────────────────────── */}
            {activeTab === "taxas" && (
              <div className="p-6 space-y-5">
                <Section title="Regime Tributário & Alíquotas">
                  <Field label="Regime tributário">
                    <Select value={form.taxRegime} onValueChange={(v) => handleTaxRegimeChange(v as TaxRegime)}>
                      <SelectTrigger className="h-9 text-sm border-neutral-200 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TAX_REGIME_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="PIX / À Vista" tooltip="Alíquota para pagamento à vista">
                      <NumInput value={form.taxCash} onChange={set("taxCash")} suffix="%" />
                    </Field>
                    <Field label="Boleto"><NumInput value={form.taxBoleto} onChange={set("taxBoleto")} suffix="%" /></Field>
                    <Field label="Débito"><NumInput value={form.taxDebit} onChange={set("taxDebit")} suffix="%" /></Field>
                    <Field label="Crédito à vista"><NumInput value={form.taxCreditCash} onChange={set("taxCreditCash")} suffix="%" /></Field>
                    <Field label="Crédito parcelado"><NumInput value={form.taxCreditInstallment} onChange={set("taxCreditInstallment")} suffix="%" /></Field>
                  </div>
                </Section>

                <Section title="Configuração de Boleto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Parcelas" tooltip="Número de parcelas do boleto"><NumInput value={form.boletoMonths} onChange={set("boletoMonths")} placeholder="3" /></Field>
                    <Field label="Juros mensal (%)"><NumInput value={form.boletoMonthlyRate} onChange={set("boletoMonthlyRate")} suffix="%" /></Field>
                    <Field label="Taxa fixa emissão (R$)"><NumInput value={form.boletoFixedFee} onChange={set("boletoFixedFee")} prefix="R$" /></Field>
                    <Field label="Risco inadimplência (%)"><NumInput value={form.boletoDefaultRisk} onChange={set("boletoDefaultRisk")} suffix="%" /></Field>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm mt-2">
                    <div>
                      <p className="text-[12px] font-medium text-neutral-800">Juros repassado ao cliente</p>
                      <p className="text-[10px] text-neutral-400">Cliente absorve os juros do boleto</p>
                    </div>
                    <Switch checked={form.boletoCustomerPaysInterest} onCheckedChange={(v) => set("boletoCustomerPaysInterest")(v)} />
                  </div>
                </Section>

                <Section title="Configuração de Cartão">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="Taxa débito (%)"><NumInput value={form.cardDebitFee} onChange={set("cardDebitFee")} suffix="%" /></Field>
                    <Field label="Taxa crédito à vista (%)"><NumInput value={form.cardCreditCashFee} onChange={set("cardCreditCashFee")} suffix="%" /></Field>
                    <Field label="Taxa crédito parcelado (%)"><NumInput value={form.cardCreditInstallmentFee} onChange={set("cardCreditInstallmentFee")} suffix="%" /></Field>
                    <Field label="Parcelas"><NumInput value={form.cardInstallments} onChange={set("cardInstallments")} placeholder="6" /></Field>
                    <Field label="Taxa antecipação (%)"><NumInput value={form.cardAnticipationRate} onChange={set("cardAnticipationRate")} suffix="%" /></Field>
                    <Field label="Juros mensal (%)"><NumInput value={form.cardMonthlyRate} onChange={set("cardMonthlyRate")} suffix="%" /></Field>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm mt-2">
                    <div>
                      <p className="text-[12px] font-medium text-neutral-800">Juros repassado ao cliente</p>
                      <p className="text-[10px] text-neutral-400">Cliente absorve os juros do cartão</p>
                    </div>
                    <Switch checked={form.cardCustomerPaysInterest} onCheckedChange={(v) => set("cardCustomerPaysInterest")(v)} />
                  </div>
                </Section>
              </div>
            )}

            {/* ── ABA 4: LINKS DE PAGAMENTO ──────────────────────────── */}
            {activeTab === "links" && (
              <div className="p-6 space-y-5">
                <Section title="Plataforma de Pagamento">
                  <Field label="Gateway / Plataforma">
                    <Select value={form.paymentPlatform} onValueChange={(v) => set("paymentPlatform")(v)}>
                      <SelectTrigger className="h-9 text-sm border-neutral-200 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
                        <SelectItem value="PAGSEGURO">PagSeguro</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Section>

                <Section title="Links Externos de Checkout">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Chave PIX" tooltip="CPF, CNPJ, email ou chave aleatória">
                      <Input value={form.pixKey} onChange={(e) => set("pixKey")(e.target.value)}
                        placeholder="Ex: 61999999999"
                        className="h-9 text-sm border-neutral-200 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="Link PIX (URL)" tooltip="URL de cobrança PIX gerada pela plataforma">
                      <Input value={form.pixLink} onChange={(e) => set("pixLink")(e.target.value)}
                        placeholder="https://..."
                        className="h-9 text-sm border-neutral-200 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="Link Cartão (URL)" tooltip="URL de checkout com cartão">
                      <Input value={form.cardPaymentUrl} onChange={(e) => set("cardPaymentUrl")(e.target.value)}
                        placeholder="https://..."
                        className="h-9 text-sm border-neutral-200 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                    <Field label="Link Boleto (URL)" tooltip="URL para geração de boleto">
                      <Input value={form.boletoUrl} onChange={(e) => set("boletoUrl")(e.target.value)}
                        placeholder="https://..."
                        className="h-9 text-sm border-neutral-200 focus:ring-0 focus-visible:ring-0" />
                    </Field>
                  </div>
                  <p className="text-[10px] text-neutral-400 bg-neutral-50 p-3 rounded-sm">
                    💡 Gere os links na sua plataforma de pagamento (Mercado Pago, PagSeguro etc.) e cole aqui.
                    Eles serão exibidos na página do produto na vitrine.
                  </p>
                </Section>
              </div>
            )}
          </div>

          {/* ── LADO DIREITO: Painel Escuro do Simulador ──────────────── */}
          <div className="lg:sticky lg:top-14 bg-neutral-950 text-white flex flex-col min-h-[500px]">

            {/* Header do painel */}
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-[9px] font-semibold tracking-[0.3em] uppercase text-white/40 mb-1">Simulador de Lucro</p>
              <h2 className="text-sm font-semibold text-white">Painel de Precificação</h2>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>

              {/* Resumo de custo */}
              {finalUnitCost > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-sm p-3">
                      <p className="text-[9px] text-white/40 tracking-wide uppercase mb-1">Custo BRL</p>
                      <p className="text-sm font-semibold text-white">{formatCurrency(costPriceBrl)}</p>
                    </div>
                    <div className="bg-white/5 rounded-sm p-3">
                      <p className="text-[9px] text-white/40 tracking-wide uppercase mb-1">Custo Final</p>
                      <p className="text-sm font-semibold text-white">{formatCurrency(finalUnitCost)}</p>
                    </div>
                  </div>

                  {/* Margem desejada */}
                  <div className="bg-white/5 rounded-sm p-3 space-y-3">
                    <p className="text-[9px] text-white/40 tracking-wide uppercase">Margem Desejada</p>
                    <div className="flex gap-1.5">
                      {(["PERCENT", "VALUE"] as const).map((m) => (
                        <button key={m} onClick={() => set("marginMode")(m)}
                          className={`flex-1 py-1.5 text-[9px] font-bold tracking-wide transition-colors ${
                            form.marginMode === m ? "bg-white text-neutral-900" : "bg-white/10 text-white/60 hover:bg-white/20"
                          }`}>
                          {m === "PERCENT" ? "%" : "R$"}
                        </button>
                      ))}
                    </div>
                    {form.marginMode === "PERCENT" ? (
                      <NumInput value={form.desiredMarginRate} onChange={set("desiredMarginRate")} suffix="%" placeholder="30" />
                    ) : (
                      <NumInput value={form.desiredMarginValue} onChange={set("desiredMarginValue")} prefix="R$" placeholder="0,00" />
                    )}
                    {effectiveMarginRate > 0 && (
                      <p className="text-[10px] text-white/40">
                        Margem efetiva: <span className="text-emerald-400 font-semibold">{effectiveMarginRate.toFixed(1)}%</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <Calculator className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-[11px] text-white/30">Informe o custo do produto para ativar o simulador</p>
                </div>
              )}

              {/* Erro de cálculo */}
              {calcError && (
                <div className="flex items-start gap-2 p-3 bg-rose-950/50 rounded-sm border border-rose-900/30">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-rose-300">{calcError}</p>
                </div>
              )}

              {/* Botão calcular */}
              {finalUnitCost > 0 && (
                <button onClick={handleCalculate}
                  className="w-full py-2.5 bg-white text-neutral-900 text-[10px] font-bold tracking-[0.15em] uppercase hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2">
                  <RefreshCcw className="w-3 h-3" /> Calcular Preços
                </button>
              )}

              {/* Resultados */}
              {pricingResult && (
                <div className="space-y-2.5">
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-[9px] font-semibold tracking-[0.25em] uppercase text-white/40 mb-3">
                      Preços Sugeridos
                    </p>
                  </div>
                  {pricingResult.results.map((r) => (
                    <DarkResultCard
                      key={r.method}
                      result={r}
                      isBest={r.method === pricingResult.bestMethod}
                      isWorst={r.method === pricingResult.worstMethod}
                    />
                  ))}
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-[10px] text-white/30">
                      Margem real (PIX):{" "}
                      <span className="text-emerald-400 font-semibold">
                        {formatPercent(pricingResult.results.find(r => r.method === "PIX")?.realMarginRate ?? 0)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer: publicar */}
            <div className="px-5 py-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-white">Publicar na Vitrine</p>
                  <p className="text-[9px] text-white/40 mt-0.5">Visível ao público</p>
                </div>
                <Switch checked={form.published} onCheckedChange={(v) => set("published")(v)}
                  className="data-[state=checked]:bg-emerald-500" />
              </div>
              <button onClick={handleSave} disabled={isSaving}
                className="w-full py-3 bg-white text-neutral-900 text-[10px] font-bold tracking-[0.18em] uppercase hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar & Publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
