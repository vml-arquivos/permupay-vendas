/**
 * ProductForm.tsx — Cadastro e Edição de Produto (v2 — Formulário Enxuto)
 *
 * MUDANÇAS v2:
 * - Seções "Configuração Fiscal", "Boleto" e "Cartão" REMOVIDAS da UI.
 * - Todas as taxas vêm exclusivamente de `trpc.paymentSettings.get` (fonte única).
 * - handleCalculate usa globalSettings em vez de estado local de taxas.
 * - taxCash (PIX) é sempre forçado como 0 no motor (regra de negócio).
 * - FormState agora contém APENAS: Identidade, Custo, Margem, Estoque, Links.
 *
 * LÓGICA DE NEGÓCIO INTACTA: hooks, queries, mutations, rotas inalteradas.
 */

import { useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  calculatePricing,
  isPricingError,
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
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info, Calculator,
  DollarSign, CreditCard, Banknote, Sparkles, Tag, Eye, Save,
  ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Settings2,
} from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type MarginMode = "PERCENT" | "VALUE";
type PaymentPlatform = "MERCADO_PAGO" | "PAGSEGURO" | "OUTRO";

/** FormState enxuto: sem campos de fiscal, boleto ou cartão */
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
  // Links de pagamento
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
    case "EXCELENTE":  return { color: "text-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "SAUDAVEL":   return { color: "text-green-400",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "ATENCAO":    return { color: "text-amber-400",   icon: <AlertCircle className="w-3.5 h-3.5" /> };
    case "RISCO":      return { color: "text-orange-400",  icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    case "PREJUIZO":   return { color: "text-red-400",     icon: <XCircle className="w-3.5 h-3.5" /> };
    default:           return { color: "text-[#5A5A52]",   icon: null };
  }
}

function methodIcon(method: PaymentMethod) {
  switch (method) {
    case "PIX":               return <Sparkles className="w-4 h-4" />;
    case "BOLETO":            return <Banknote className="w-4 h-4" />;
    case "DEBITO":            return <CreditCard className="w-4 h-4" />;
    case "CREDITO_A_VISTA":   return <CreditCard className="w-4 h-4" />;
    case "CREDITO_PARCELADO": return <Tag className="w-4 h-4" />;
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Field({ label, tooltip, required, children }: {
  label: string; tooltip?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] font-semibold text-[#5A5A52] tracking-[0.12em] uppercase">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-[#3A3A34] cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-[11px] border-[#2A2A26] rounded-sm" style={{ backgroundColor: "#0F0F0E", color: "#C8B99A" }}>
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function NI({ value, onChange, placeholder, prefix, suffix, disabled }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; disabled?: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-[10px] text-[#4A4A44] pointer-events-none font-mono">{prefix}</span>}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        step="any" min={0}
        disabled={disabled}
        className={`h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      />
      {suffix && <span className="absolute right-3 text-[10px] text-[#4A4A44] pointer-events-none font-mono">{suffix}</span>}
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1E1E1B] overflow-hidden mb-0" style={{ backgroundColor: "#111110" }}>
      <div className="px-4 py-3 border-b border-[#1A1A17]" style={{ backgroundColor: "#0F0F0E" }}>
        <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-[#5A5A52]"
          style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {title}
        </span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function DarkResultCard({ result, isBest }: { result: PaymentResult; isBest: boolean }) {
  const diag = diagnosticConfig(result.diagnostic);
  return (
    <div className={`p-3.5 border transition-all ${isBest ? "border-[#C8B99A]/20 bg-[#C8B99A]/5" : "border-[#1E1E1B] bg-[#111110]"}`}>
      {isBest && (
        <span className="inline-flex items-center gap-1 text-[7px] font-bold tracking-[0.25em] uppercase text-[#C8B99A] mb-2"
          style={{ fontFamily: "'Montserrat', sans-serif" }}>
          <TrendingUp className="w-2.5 h-2.5" /> Melhor opção
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[#C8B99A]">{methodIcon(result.method)}</span>
          <div>
            <p className="text-[10px] font-semibold text-[#7A7268] tracking-wider uppercase"
              style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {result.methodLabel}
            </p>
            {result.installments > 1 && (
              <p className="text-[9px] text-[#3A3A34] font-light">
                {result.installments}× {formatCurrency(result.installmentValue)}
              </p>
            )}
          </div>
        </div>
        <span className={`text-[8px] font-bold tracking-wide ${diag.color}`}
          style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {result.diagnostic}
        </span>
      </div>
      <p className="text-xl font-bold text-[#E8E3D8] tracking-tight mb-2.5"
        style={{ fontFamily: "'Lato', sans-serif" }}>
        {formatCurrency(result.suggestedPrice)}
      </p>
      <div className="space-y-1 text-[9px] border-t border-[#1A1A17] pt-2.5">
        <div className="flex justify-between">
          <span className="text-[#3A3A34] font-light">Impostos:</span>
          <span className="text-[#5A5A52]">{formatCurrency(result.totalTax)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#3A3A34] font-light">Taxas/Juros:</span>
          <span className="text-[#5A5A52]">{formatCurrency(result.totalFees + result.totalInterest)}</span>
        </div>
        <div className="flex justify-between border-t border-[#1A1A17] pt-1">
          <span className="text-[#3A3A34] font-light">Lucro líquido:</span>
          <span className={`font-semibold ${result.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {formatCurrency(result.netProfit)} ({formatPercent(result.realMarginRate)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#2E2E2A] font-light">Preço psicológico:</span>
          <span className="text-[#3A3A34]">{formatCurrency(result.psychologicalPrice)}</span>
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
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const productQuery = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: isEditing }
  );
  const utils = trpc.useUtils();
  const addImageMutation = trpc.products.addImage.useMutation();

  /**
   * FONTE ÚNICA DE TAXAS: configurações globais de pagamento.
   * O ProductForm NÃO tem mais estados locais de fiscal, boleto ou cartão.
   */
  const globalSettings = trpc.paymentSettings.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: async (newProduct) => {
      if (pendingImages.length > 0) {
        for (const file of pendingImages) {
          try {
            const uploadResp = await fetch(
              `/api/upload/image?productId=${newProduct.id}&filename=${encodeURIComponent(file.name)}`,
              {
                method: "POST",
                body: file,
                headers: { "Content-Type": file.type || "application/octet-stream" },
              }
            );
            if (!uploadResp.ok) throw new Error(`Falha no upload: ${uploadResp.statusText}`);
            const { url } = await uploadResp.json();
            await addImageMutation.mutateAsync({
              productId: newProduct.id,
              url,
              storageKey: url,
              altText: file.name,
            });
          } catch {
            toast.warning(`Imagem "${file.name}" não pôde ser enviada. Produto criado normalmente.`);
          }
        }
      }
      utils.products.list.invalidate();
      setLocation("/produtos");
      toast.success("Produto criado!");
    },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setLocation("/produtos");
      toast.success("Produto atualizado!");
    },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePendingImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    setPendingImages(files);
    setPendingPreviews(files.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }, []);

  useEffect(() => {
    return () => { pendingPreviews.forEach((url) => URL.revokeObjectURL(url)); };
  }, [pendingPreviews]);

  const set = useCallback(
    (field: keyof FormState) => (value: string | boolean) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

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
        paymentPlatform: (p.paymentPlatform as PaymentPlatform) || "OUTRO",
        pixKey: p.pixKey || "",
        pixLink: p.pixLink || "",
        cardPaymentUrl: p.cardPaymentUrl || "",
        boletoUrl: p.boletoUrl || "",
      }));
    }
  }, [productQuery.data]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const costPriceBrl = useMemo(() => {
    if (form.costCurrency === "USD") return n(form.costPriceUsd) * n(form.usdExchangeRate);
    return n(form.costPrice);
  }, [form.costCurrency, form.costPrice, form.costPriceUsd, form.usdExchangeRate]);

  const finalUnitCost = useMemo(
    () => costPriceBrl + n(form.packagingCost) + n(form.inboundShippingCost) + n(form.operationalCost),
    [costPriceBrl, form.packagingCost, form.inboundShippingCost, form.operationalCost]
  );

  const effectiveMarginRate = useMemo(() => {
    if (form.marginMode === "VALUE") {
      if (finalUnitCost <= 0) return 0;
      return (n(form.desiredMarginValue) / finalUnitCost) * 100;
    }
    return n(form.desiredMarginRate);
  }, [form.marginMode, form.desiredMarginRate, form.desiredMarginValue, finalUnitCost]);

  // ── Calcular — usa EXCLUSIVAMENTE globalSettings ──────────────────────────
  const handleCalculate = useCallback(() => {
    setCalcError(null);
    if (!form.name.trim()) { setCalcError("Informe o nome do produto."); return; }
    if (costPriceBrl <= 0) { setCalcError("Informe o preço de custo."); return; }
    if (!globalSettings.data) { setCalcError("Aguardando configurações globais de pagamento..."); return; }

    const gs = globalSettings.data;

    const input: PricingInput = {
      productName: form.name.trim(),
      category: form.category,
      ncm: form.ncm || undefined,
      costPrice: costPriceBrl,
      packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost),
      desiredMarginRate: effectiveMarginRate,
      // Regime fiscal da configuração global
      taxRegime: (gs.taxRegime as TaxRegime) ?? "SIMPLES_NACIONAL",
      taxRates: {
        cash: 0,                                          // PIX: sempre isento
        boleto: gs.taxBoleto ?? 6,
        debit: gs.taxDebit ?? 6,
        creditCash: gs.taxCreditCash ?? 6,
        creditInstallment: gs.taxCreditInstallment ?? 6,
      },
      boleto: {
        months: Math.max(1, Math.round(gs.boletoMonths ?? 3)),
        monthlyInterestRate: gs.boletoMonthlyRate ?? 1.99,
        fixedFee: gs.boletoFixedFee ?? 3.50,
        defaultRiskRate: gs.boletoDefaultRisk ?? 2,
        customerPaysInterest: gs.boletoCustomerPaysInterest ?? false,
      },
      card: {
        debitFeeRate: gs.cardDebitFee ?? 1.5,
        creditCashFeeRate: gs.cardCreditCashFee ?? 2.5,
        creditInstallmentFeeRate: gs.cardCreditInstallmentFee ?? 3.5,
        installments: Math.max(1, Math.round(gs.cardInstallments ?? 6)),
        anticipationRate: gs.cardAnticipationRate ?? 1.5,
        monthlyInterestRate: gs.cardMonthlyRate ?? 1.99,
        customerPaysInterest: gs.cardCustomerPaysInterest ?? false,
      },
    };

    const calc = calculatePricing(input);
    if (isPricingError(calc)) { setCalcError(calc.message); return; }
    setPricingResult(calc);
  }, [form, costPriceBrl, effectiveMarginRate, globalSettings.data]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }
    setIsSaving(true);

    const gs = globalSettings.data;
    const pixResult    = pricingResult?.results.find((r) => r.method === "PIX");
    const cardResult   = pricingResult?.results.find((r) => r.method === "CREDITO_A_VISTA");
    const boletoResult = pricingResult?.results.find((r) => r.method === "BOLETO");
    const bestResult   = pricingResult?.results.find((r) => r.method === pricingResult.bestMethod);

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
      marginMode: form.marginMode,
      // Fiscal — espelha as configurações globais no snapshot do produto
      taxRegime: (gs?.taxRegime as TaxRegime) ?? "SIMPLES_NACIONAL",
      estimatedTaxRate: 0, // PIX isento — referência global
      taxCash: 0,          // PIX sempre zero
      taxBoleto: gs?.taxBoleto ?? 6,
      taxDebit: gs?.taxDebit ?? 6,
      taxCreditCash: gs?.taxCreditCash ?? 6,
      taxCreditInstallment: gs?.taxCreditInstallment ?? 6,
      // Boleto — espelha configurações globais
      boletoMonths: gs?.boletoMonths ?? 3,
      boletoMonthlyRate: gs?.boletoMonthlyRate ?? 1.99,
      boletoFixedFee: gs?.boletoFixedFee ?? 3.5,
      boletoDefaultRisk: gs?.boletoDefaultRisk ?? 2,
      boletoCustomerPaysInterest: gs?.boletoCustomerPaysInterest ?? false,
      // Cartão — espelha configurações globais
      cardDebitFee: gs?.cardDebitFee ?? 1.5,
      cardCreditCashFee: gs?.cardCreditCashFee ?? 2.5,
      cardCreditInstallmentFee: gs?.cardCreditInstallmentFee ?? 3.5,
      cardInstallments: gs?.cardInstallments ?? 6,
      cardAnticipationRate: gs?.cardAnticipationRate ?? 1.5,
      cardMonthlyRate: gs?.cardMonthlyRate ?? 1.99,
      cardCustomerPaysInterest: gs?.cardCustomerPaysInterest ?? false,
      // Preços calculados
      suggestedPrice: bestResult?.suggestedPrice ?? 0,
      suggestedPricePix: pixResult?.suggestedPrice ?? 0,
      suggestedPriceCard: cardResult?.suggestedPrice ?? 0,
      suggestedPriceBoleto: boletoResult?.suggestedPrice ?? 0,
      // Links de pagamento
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
  }, [form, costPriceBrl, effectiveMarginRate, pricingResult, globalSettings.data, isEditing, productId, createProduct, updateProduct]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isEditing && productQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="w-5 h-5 border-2 border-[#2E2E2A] border-t-[#C8B99A] rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#4A4A44] tracking-widest uppercase font-light">Carregando produto...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div
        className="max-w-[1200px] mx-auto"
        style={{ fontFamily: "'Lato', 'Montserrat', sans-serif" }}
      >

        {/* ── Topbar da página ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/produtos")}
              className="flex items-center gap-1.5 text-[#3A3A34] hover:text-[#7A7268] transition-colors"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "9px", letterSpacing: "0.18em" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
            </button>
            <div className="pl-4 border-l border-[#1E1E1B]">
              <h1
                className="text-[#E8E3D8]"
                style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, fontSize: "1.1rem", letterSpacing: "-0.005em" }}
              >
                {isEditing ? "Editar Produto" : "Novo Produto"}
              </h1>
              <p className="text-[#3A3A34] mt-0.5 font-light"
                style={{ fontFamily: "'Lato', sans-serif", fontSize: "10px" }}>
                Cadastro, precificação e publicação na vitrine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && (
              <a
                href={`/vitrine/${productId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 border border-[#2A2A26] text-[#4A4A44] hover:border-[#C8B99A]/30 hover:text-[#C8B99A] transition-all"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.18em" }}
              >
                <Eye className="w-3 h-3" /> VER NA VITRINE
              </a>
            )}
            <button
              onClick={handleCalculate}
              disabled={!form.name.trim() || costPriceBrl <= 0 || globalSettings.isLoading}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#2A2A26] text-[#5A5A52] hover:border-[#C8B99A]/30 hover:text-[#C8B99A] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.18em" }}
            >
              <Calculator className="w-3 h-3" /> CALCULAR PREÇOS
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C8B99A] text-[#0F0F0E] hover:bg-[#D9CEBA] transition-colors disabled:opacity-40"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.18em" }}
            >
              <Save className="w-3 h-3" />
              {isSaving ? "SALVANDO..." : isEditing ? "SALVAR ALTERAÇÕES" : "CRIAR PRODUTO"}
            </button>
          </div>
        </div>

        {/* Alerta: configurações globais não carregadas */}
        {globalSettings.isError && (
          <div
            className="flex items-center gap-2.5 p-3 border border-amber-900/30 mb-5"
            style={{ backgroundColor: "rgba(120,53,15,0.1)" }}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-amber-400/80 text-[10px] font-light">
              Não foi possível carregar as configurações globais de pagamento. Os preços calculados podem estar incorretos.
            </p>
          </div>
        )}

        {/* Grid: formulário + simulador ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0 items-start">

          {/* ── FORMULÁRIO ─────────────────────────────────────────────── */}
          <div className="space-y-3 border border-[#1E1E1B]" style={{ backgroundColor: "#111110" }}>

            {/* 1. IDENTIDADE DO PRODUTO */}
            <SectionBlock title="Identidade do Produto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <Field label="Nome do produto" required>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name")(e.target.value)}
                    placeholder="Ex: Sauvage Eau de Parfum 100ml"
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm sm:col-span-2"
                  />
                </Field>

                <Field label="Categoria" required>
                  <Select value={form.category} onValueChange={(v) => set("category")(v)}>
                    <SelectTrigger className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] focus:ring-0 rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2A2A26] rounded-sm" style={{ backgroundColor: "#111110" }}>
                      {(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"] as ProductCategory[]).map((c) => (
                        <SelectItem key={c} value={c} className="text-sm text-[#E8E3D8] focus:bg-[#1A1A17] focus:text-[#C8B99A]">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Label de categoria" tooltip="Exibida na vitrine. Ex: Perfumes Importados">
                  <Input
                    value={form.categoryLabel}
                    onChange={(e) => set("categoryLabel")(e.target.value)}
                    placeholder="Ex: Perfumes Importados"
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>

                <Field label="NCM">
                  <Input
                    value={form.ncm}
                    onChange={(e) => set("ncm")(e.target.value)}
                    placeholder="Ex: 3303.00.10"
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>

                <Field label="Tag de promoção" tooltip='Aparece como badge na vitrine. Ex: "OFERTA"'>
                  <Input
                    value={form.promoTag}
                    onChange={(e) => set("promoTag")(e.target.value)}
                    placeholder="Ex: OFERTA"
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>
              </div>

              <Field label="Descrição curta" tooltip="Aparece nos cards da vitrine (máx. 120 caracteres)">
                <Input
                  value={form.shortDescription}
                  onChange={(e) => set("shortDescription")(e.target.value)}
                  placeholder="Breve descrição atrativa"
                  className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  maxLength={120}
                />
              </Field>

              <Field label="Descrição completa">
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder="Descrição detalhada do produto..."
                  rows={5}
                  className="text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] resize-none focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                />
              </Field>

              <div
                className="flex items-center justify-between p-3.5 border border-[#1A1A17]"
                style={{ backgroundColor: "#161614" }}
              >
                <div>
                  <p className="text-[11px] font-medium text-[#E8E3D8] tracking-wide">Publicado na vitrine</p>
                  <p className="text-[9px] text-[#3A3A34] mt-0.5 font-light">Produto visível ao público</p>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => set("published")(v)}
                  className="data-[state=checked]:bg-[#C8B99A]"
                />
              </div>

              {isEditing && productId ? (
                <div>
                  <p className="text-[8px] text-[#3A3A34] uppercase mb-2 tracking-[0.25em] font-semibold"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Galeria de imagens
                  </p>
                  <ImageGallery productId={productId} />
                </div>
              ) : (
                <div>
                  <p className="text-[8px] text-[#3A3A34] uppercase mb-2 tracking-[0.25em] font-semibold"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Imagens pré-seleção (após criar)
                  </p>
                  {pendingPreviews.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {pendingPreviews.map((src, i) => (
                        <img key={i} src={src} alt="" className="w-16 h-16 object-cover border border-[#222220]" />
                      ))}
                    </div>
                  ) : (
                    <label className="flex items-center justify-center border border-dashed border-[#1E1E1B] h-20 cursor-pointer hover:border-[#C8B99A]/20 transition-colors"
                      style={{ backgroundColor: "#0F0F0E" }}>
                      <span className="text-[9px] text-[#2E2E2A] font-light">Clique para selecionar imagens</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePendingImageSelect} />
                    </label>
                  )}
                </div>
              )}
            </SectionBlock>

            {/* 2. CUSTOS & ESTOQUE */}
            <SectionBlock title="Custos & Estoque">
              {/* Seletor de moeda */}
              <div className="flex items-center gap-3 p-3 border border-[#1A1A17]" style={{ backgroundColor: "#161614" }}>
                <span className="text-[9px] font-semibold text-[#4A4A44] tracking-[0.2em] uppercase"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Moeda:
                </span>
                <div className="flex gap-1.5">
                  {(["BRL", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => set("costCurrency")(c)}
                      className={`px-3 py-1 text-[9px] font-bold tracking-wider uppercase transition-colors ${
                        form.costCurrency === c
                          ? "bg-[#C8B99A] text-[#0F0F0E]"
                          : "border border-[#2A2A26] text-[#4A4A44] hover:border-[#C8B99A]/30 hover:text-[#C8B99A]"
                      }`}
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {form.costCurrency === "BRL" ? (
                  <Field label="Preço de custo (R$)" required>
                    <NI value={form.costPrice} onChange={set("costPrice") as any} prefix="R$" placeholder="0,00" />
                  </Field>
                ) : (
                  <>
                    <Field label="Preço em dólar (US$)" required>
                      <NI value={form.costPriceUsd} onChange={set("costPriceUsd") as any} prefix="US$" placeholder="0,00" />
                    </Field>
                    <Field label="Cotação do dólar">
                      <NI value={form.usdExchangeRate} onChange={set("usdExchangeRate") as any} prefix="R$" placeholder="5.50" />
                    </Field>
                    <Field label="Custo em R$ (calculado)">
                      <NI value={costPriceBrl > 0 ? costPriceBrl.toFixed(2) : ""} onChange={() => {}} prefix="R$" disabled />
                    </Field>
                  </>
                )}
                <Field label="Custo de embalagem">
                  <NI value={form.packagingCost} onChange={set("packagingCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
                <Field label="Frete de entrada">
                  <NI value={form.inboundShippingCost} onChange={set("inboundShippingCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
                <Field label="Custo operacional">
                  <NI value={form.operationalCost} onChange={set("operationalCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
              </div>

              {finalUnitCost > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border border-[#1A1A17]" style={{ backgroundColor: "#161614" }}>
                    <p className="text-[8px] font-bold tracking-[0.22em] uppercase text-[#4A4A44] mb-1"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      Custo em BRL
                    </p>
                    <p className="text-base font-semibold text-[#E8E3D8]"
                      style={{ fontFamily: "'Lato', sans-serif" }}>
                      {formatCurrency(costPriceBrl)}
                    </p>
                  </div>
                  <div className="p-3 border border-[#C8B99A]/15" style={{ backgroundColor: "#1A160E" }}>
                    <p className="text-[8px] font-bold tracking-[0.22em] uppercase text-[#C8B99A]/60 mb-1"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      Custo Final Unitário
                    </p>
                    <p className="text-base font-semibold text-[#C8B99A]"
                      style={{ fontFamily: "'Lato', sans-serif" }}>
                      {formatCurrency(finalUnitCost)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1A1A17]">
                <Field label="Estoque atual">
                  <NI value={form.stockQuantity} onChange={set("stockQuantity") as any} placeholder="0" />
                </Field>
                <Field label="Estoque mínimo" tooltip="Alerta de reposição">
                  <NI value={form.minimumStock} onChange={set("minimumStock") as any} placeholder="0" />
                </Field>
              </div>
            </SectionBlock>

            {/* 3. MARGEM DE LUCRO */}
            <SectionBlock title="Margem de Lucro Desejada">
              <div className="flex gap-1.5 mb-4">
                {(["PERCENT", "VALUE"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => set("marginMode")(m)}
                    className={`px-4 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-colors ${
                      form.marginMode === m
                        ? "bg-[#C8B99A] text-[#0F0F0E]"
                        : "border border-[#2A2A26] text-[#4A4A44] hover:border-[#C8B99A]/30 hover:text-[#C8B99A]"
                    }`}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {m === "PERCENT" ? "Porcentagem (%)" : "Valor (R$)"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.marginMode === "PERCENT" ? (
                  <Field label="Margem desejada (%)" required>
                    <NI value={form.desiredMarginRate} onChange={set("desiredMarginRate") as any} suffix="%" placeholder="30" />
                  </Field>
                ) : (
                  <Field label="Margem em valor (R$)" required>
                    <NI value={form.desiredMarginValue} onChange={set("desiredMarginValue") as any} prefix="R$" placeholder="0,00" />
                  </Field>
                )}
                <Field label="Margem efetiva" disabled>
                  <NI value={effectiveMarginRate.toFixed(2)} onChange={() => {}} suffix="%" disabled />
                </Field>
              </div>

              {/* Aviso: taxas vêm das configurações globais */}
              <div
                className="flex items-start gap-2.5 p-3 border border-[#1A1A17]"
                style={{ backgroundColor: "#0D0D0C" }}
              >
                <Settings2 className="w-3.5 h-3.5 text-[#C8B99A]/60 shrink-0 mt-0.5" />
                <div>
                  <p
                    className="text-[#7A7268]"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "7px", letterSpacing: "0.22em" }}
                  >
                    TAXAS & IMPOSTOS — CONFIGURAÇÕES GLOBAIS
                  </p>
                  <p className="text-[#3A3A34] mt-0.5 font-light" style={{ fontSize: "9px" }}>
                    Fiscal, Boleto e Cartão são gerenciados em{" "}
                    <a
                      href="/configuracoes-pagamento"
                      className="text-[#C8B99A]/70 hover:text-[#C8B99A] underline transition-colors"
                    >
                      Configurações → Pagamento
                    </a>
                    {globalSettings.data && (
                      <span className="text-[#2E2E2A] ml-1">
                        · Regime atual: {globalSettings.data.taxRegime ?? "SIMPLES_NACIONAL"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </SectionBlock>

            {/* 4. LINKS DE PAGAMENTO */}
            <SectionBlock title="Links de Pagamento">
              <Field label="Plataforma de pagamento">
                <Select value={form.paymentPlatform} onValueChange={(v) => set("paymentPlatform")(v)}>
                  <SelectTrigger className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] focus:ring-0 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#2A2A26] rounded-sm" style={{ backgroundColor: "#111110" }}>
                    <SelectItem value="MERCADO_PAGO" className="text-sm text-[#E8E3D8] focus:bg-[#1A1A17] focus:text-[#C8B99A]">Mercado Pago</SelectItem>
                    <SelectItem value="PAGSEGURO" className="text-sm text-[#E8E3D8] focus:bg-[#1A1A17] focus:text-[#C8B99A]">PagSeguro</SelectItem>
                    <SelectItem value="OUTRO" className="text-sm text-[#E8E3D8] focus:bg-[#1A1A17] focus:text-[#C8B99A]">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Chave PIX" tooltip="CPF, CNPJ, email ou chave aleatória">
                  <Input
                    value={form.pixKey}
                    onChange={(e) => set("pixKey")(e.target.value)}
                    placeholder="Ex: 61999999999"
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>
                <Field label="Link PIX (URL)">
                  <Input
                    value={form.pixLink}
                    onChange={(e) => set("pixLink")(e.target.value)}
                    placeholder="https://..."
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>
                <Field label="Link Cartão (URL)">
                  <Input
                    value={form.cardPaymentUrl}
                    onChange={(e) => set("cardPaymentUrl")(e.target.value)}
                    placeholder="https://..."
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>
                <Field label="Link Boleto (URL)">
                  <Input
                    value={form.boletoUrl}
                    onChange={(e) => set("boletoUrl")(e.target.value)}
                    placeholder="https://..."
                    className="h-9 text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
                  />
                </Field>
              </div>
            </SectionBlock>

            {/* 5. NOTAS INTERNAS */}
            <SectionBlock title="Observações Internas">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Notas internas (não aparecem na vitrine)..."
                rows={3}
                className="text-sm border-[#222220] bg-[#1A1A17] text-[#E8E3D8] placeholder-[#3A3A34] resize-none focus:border-[#C8B99A]/40 focus:ring-0 focus-visible:ring-0 rounded-sm"
              />
            </SectionBlock>
          </div>

          {/* ── PAINEL DO SIMULADOR (coluna direita) ─────────────────────── */}
          <div
            className="lg:sticky lg:top-[60px] flex flex-col min-h-[400px] border-t lg:border-t-0 border-[#1E1E1B]"
            style={{ backgroundColor: "#0A0A09" }}
          >
            <div className="px-5 py-4 border-b border-[#1A1A17]">
              <p className="text-[7px] font-bold tracking-[0.35em] uppercase text-[#3A3A34] mb-1"
                style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Simulador de Lucro
              </p>
              <h2 className="text-sm font-light text-[#E8E3D8] tracking-wide"
                style={{ fontFamily: "'Lato', sans-serif" }}>
                Painel de Precificação
              </h2>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>

              {/* Resumo de custo */}
              {finalUnitCost > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 border border-[#1A1A17]" style={{ backgroundColor: "#111110" }}>
                      <p className="text-[8px] text-[#3A3A34] tracking-wider uppercase mb-1 font-semibold"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        Custo BRL
                      </p>
                      <p className="text-sm font-semibold text-[#E8E3D8]"
                        style={{ fontFamily: "'Lato', sans-serif" }}>
                        {formatCurrency(costPriceBrl)}
                      </p>
                    </div>
                    <div className="p-3 border border-[#1A1A17]" style={{ backgroundColor: "#111110" }}>
                      <p className="text-[8px] text-[#3A3A34] tracking-wider uppercase mb-1 font-semibold"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        Custo Final
                      </p>
                      <p className="text-sm font-semibold text-[#C8B99A]"
                        style={{ fontFamily: "'Lato', sans-serif" }}>
                        {formatCurrency(finalUnitCost)}
                      </p>
                    </div>
                  </div>

                  {/* Margem inline do simulador */}
                  <div className="p-3 space-y-3 border border-[#1A1A17]" style={{ backgroundColor: "#111110" }}>
                    <p className="text-[8px] text-[#3A3A34] tracking-[0.25em] uppercase font-semibold"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      Margem Desejada
                    </p>
                    <div className="flex gap-1.5">
                      {(["PERCENT", "VALUE"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => set("marginMode")(m)}
                          className={`flex-1 py-1.5 text-[9px] font-bold tracking-wide transition-colors ${
                            form.marginMode === m
                              ? "bg-[#C8B99A] text-[#0F0F0E]"
                              : "bg-[#1A1A17] text-[#4A4A44] hover:text-[#C8B99A]"
                          }`}
                          style={{ fontFamily: "'Montserrat', sans-serif" }}
                        >
                          {m === "PERCENT" ? "%" : "R$"}
                        </button>
                      ))}
                    </div>
                    {form.marginMode === "PERCENT" ? (
                      <NI value={form.desiredMarginRate} onChange={set("desiredMarginRate") as any} suffix="%" placeholder="30" />
                    ) : (
                      <NI value={form.desiredMarginValue} onChange={set("desiredMarginValue") as any} prefix="R$" placeholder="0,00" />
                    )}
                    {effectiveMarginRate > 0 && (
                      <p className="text-[9px] text-[#3A3A34] font-light">
                        Margem efetiva:{" "}
                        <span className="text-emerald-500 font-semibold">{effectiveMarginRate.toFixed(1)}%</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <Calculator className="w-7 h-7 text-[#1E1E1B] mx-auto" />
                  <p className="text-[10px] text-[#2A2A26] font-light tracking-wide">
                    Informe o custo do produto para ativar o simulador
                  </p>
                </div>
              )}

              {/* Erro de cálculo */}
              {calcError && (
                <div className="flex items-start gap-2 p-3 border border-rose-900/30" style={{ backgroundColor: "#1A0808" }}>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-rose-500 font-light">{calcError}</p>
                </div>
              )}

              {/* Botão calcular */}
              {finalUnitCost > 0 && (
                <button
                  onClick={handleCalculate}
                  disabled={globalSettings.isLoading}
                  className="w-full py-2.5 bg-[#C8B99A] text-[#0F0F0E] hover:bg-[#D9CEBA] transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "9px", letterSpacing: "0.2em" }}
                >
                  <RefreshCcw className="w-3 h-3" /> CALCULAR PREÇOS
                </button>
              )}

              {/* Resultados */}
              {pricingResult && (
                <div className="space-y-2.5">
                  <div className="border-t border-[#1A1A17] pt-3">
                    <p className="text-[8px] font-bold tracking-[0.3em] uppercase text-[#3A3A34] mb-3"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      Preços Sugeridos
                    </p>
                  </div>
                  {pricingResult.results.map((r) => (
                    <DarkResultCard
                      key={r.method}
                      result={r}
                      isBest={r.method === pricingResult.bestMethod}
                    />
                  ))}
                  <div className="pt-2 border-t border-[#1A1A17]">
                    <p className="text-[9px] text-[#2E2E2A] font-light">
                      Margem real (PIX):{" "}
                      <span className="text-emerald-500 font-semibold">
                        {formatPercent(pricingResult.results.find((r) => r.method === "PIX")?.realMarginRate ?? 0)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer: publicar */}
            <div className="px-5 py-4 border-t border-[#1A1A17] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#E8E3D8] tracking-wide"
                    style={{ fontFamily: "'Lato', sans-serif" }}>
                    Publicar na Vitrine
                  </p>
                  <p className="text-[8px] text-[#3A3A34] mt-0.5 font-light">Visível ao público</p>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => set("published")(v)}
                  className="data-[state=checked]:bg-[#C8B99A]"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-[#C8B99A] text-[#0F0F0E] hover:bg-[#D9CEBA] transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "9px", letterSpacing: "0.22em" }}
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "SALVANDO..." : isEditing ? "SALVAR ALTERAÇÕES" : "CRIAR & PUBLICAR"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
