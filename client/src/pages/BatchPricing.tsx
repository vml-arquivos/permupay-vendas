/**
 * BatchPricing.tsx — Entrada de Produtos profissional, sem tabela espremida
 *
 * Esta tela registra entradas de produtos/lotes, calcula custo real com rateio
 * proporcional, permite produto existente ou novo, preserva FIFO e exporta
 * planilha .xlsx do preview atual.
 */

import { useMemo, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  PlusCircle,
  Trash2,
  Calculator,
  PackageCheck,
  ChevronLeft,
  Clock,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  PackagePlus,
  Download,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateBatchPricing,
  formatCurrency,
  formatPercent,
  isBatchPricingError,
  type BatchItemInput,
  type BatchPricingResult,
} from "@shared/pricing.batch";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type EntryMode = "EXISTING" | "NEW";
type AcquisitionCurrency = "BRL" | "USD";
type AcquisitionPaymentMethod =
  | "DINHEIRO"
  | "PIX"
  | "BOLETO"
  | "CARTAO"
  | "DOLAR"
  | "OUTRO";
type ProductCategory = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";

type LocalItem = {
  _id: string;
  entryMode: EntryMode;
  productId?: number;
  productName: string;
  category: ProductCategory;
  currency: AcquisitionCurrency;
  unitCostOriginal: string;
  exchangeRate: string;
  quantity: string;
  acquisitionPaymentMethod: AcquisitionPaymentMethod;
  desiredMarginRate: string;
  estimatedTaxRate: string;
};

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "CELULAR", label: "Celular" },
  { value: "ELETRONICO", label: "Eletrônico" },
  { value: "PERFUME", label: "Perfume" },
  { value: "OUTRO", label: "Outro" },
];

const PAYMENT_OPTIONS: { value: AcquisitionPaymentMethod; label: string }[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DOLAR", label: "Dólar" },
  { value: "OUTRO", label: "Outro" },
];

const emptyItem = (): LocalItem => ({
  _id: crypto.randomUUID(),
  entryMode: "EXISTING",
  productName: "",
  productId: undefined,
  category: "OUTRO",
  currency: "BRL",
  unitCostOriginal: "",
  exchangeRate: "",
  quantity: "",
  desiredMarginRate: "",
  estimatedTaxRate: "",
  acquisitionPaymentMethod: "PIX",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const raw = value.trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/[R$US$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: string): number {
  return toNumber(value);
}

function cleanFileName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "entrada-produtos"
  ).toLowerCase();
}

function resolveUnitCostBrl(item: LocalItem): number {
  const original = toMoney(item.unitCostOriginal);
  if (item.currency === "USD") return original * toNumber(item.exchangeRate);
  return original;
}

function normalizeItem(item: LocalItem) {
  const unitCostBrl = resolveUnitCostBrl(item);
  return {
    ...item,
    unitCostOriginalNumber: toMoney(item.unitCostOriginal),
    exchangeRateNumber: item.currency === "USD" ? toNumber(item.exchangeRate) : 0,
    unitCostBrl,
    quantityNumber: Math.trunc(toNumber(item.quantity)),
    desiredMarginRateNumber: toNumber(item.desiredMarginRate),
    estimatedTaxRateNumber: toNumber(item.estimatedTaxRate),
  };
}

function toBatchItem(item: LocalItem): BatchItemInput {
  const normalized = normalizeItem(item);
  return {
    productId: normalized.productId,
    productName: normalized.productName.trim(),
    unitCostOriginal: normalized.unitCostOriginalNumber,
    costCurrency: normalized.currency,
    exchangeRate: normalized.exchangeRateNumber,
    acquisitionPaymentMethod: normalized.acquisitionPaymentMethod,
    unitCostBrl: normalized.unitCostBrl,
    quantity: normalized.quantityNumber,
    desiredMarginRate: normalized.desiredMarginRateNumber,
    estimatedTaxRate: normalized.estimatedTaxRateNumber,
  };
}

function displayMoneyOrEmpty(value: number): string {
  return value > 0 ? formatCurrency(value) : "";
}

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextNumberInput({
  value,
  onChange,
  placeholder,
  integer = false,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-10 text-sm ${className}`}
    />
  );
}

function ReadOnlyMoney({ value, placeholder = "Calculado" }: { value: number; placeholder?: string }) {
  return (
    <Input
      value={displayMoneyOrEmpty(value)}
      readOnly
      disabled
      placeholder={placeholder}
      className="h-10 bg-muted/40 text-sm font-semibold"
    />
  );
}

function SummaryBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BatchPricing() {
  const [, setLocation] = useLocation();

  // Cabeçalho — strings para não forçar zero visual no input
  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [totalOperationalCost, setTotalOperationalCost] = useState("");
  const [totalTaxCost, setTotalTaxCost] = useState("");
  const [totalOtherCost, setTotalOtherCost] = useState("");

  const [fifoMode, setFifoMode] = useState(true);
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);

  const [preview, setPreview] = useState<BatchPricingResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState<number | null>(null);
  const [fifoResult, setFifoResult] = useState<{
    queuedCount: number;
    activatedCount: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const productsQuery = trpc.products.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const createProduct = trpc.products.create.useMutation();

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: (batch) => setSavedBatchId(batch.id),
  });

  const processBatch = trpc.batches.process.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      toast.success("Entrada processada! Estoque atualizado.");
      setLocation("/entrada-produtos");
    },
    onError: (err) => toast.error(err.message),
  });

  const processFIFO = trpc.batches.processFIFO.useMutation({
    onSuccess: (data) => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      setFifoResult(data);
      toast.success(
        `Entrada FIFO processada! ${data.activatedCount} ativado(s), ${data.queuedCount} na fila de espera.`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const totals = useMemo(() => {
    const normalized = items.map(normalizeItem);
    const totalQuantity = normalized.reduce((sum, item) => sum + item.quantityNumber, 0);
    const goodsTotal = normalized.reduce(
      (sum, item) => sum + item.unitCostBrl * item.quantityNumber,
      0
    );
    const additionalTotal =
      toMoney(totalOperationalCost) + toMoney(totalTaxCost) + toMoney(totalOtherCost);
    return {
      totalQuantity,
      goodsTotal,
      additionalTotal,
      grandTotal: goodsTotal + additionalTotal,
      productTypes: items.length,
    };
  }, [items, totalOperationalCost, totalTaxCost, totalOtherCost]);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item._id !== id)));

  const updateItem = useCallback(
    <K extends keyof LocalItem>(id: string, field: K, value: LocalItem[K]) => {
      setItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const applyExistingProduct = useCallback(
    (itemId: string, rawProductId: string) => {
      const selectedId = rawProductId ? Number(rawProductId) : undefined;
      const selected = productsQuery.data?.find((product: any) => product.id === selectedId) as any;

      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== itemId) return item;
          if (!selected) return { ...item, productId: undefined, entryMode: "EXISTING" };

          const fallbackCost = Number(
            selected.finalUnitCostBrl ?? selected.averageCostBrl ?? selected.costPrice ?? 0
          );

          return {
            ...item,
            entryMode: "EXISTING",
            productId: selected.id,
            productName: selected.name ?? item.productName,
            category: (selected.category as ProductCategory) ?? item.category,
            currency: "BRL",
            unitCostOriginal:
              item.unitCostOriginal.trim() || (fallbackCost > 0 ? String(fallbackCost) : ""),
          };
        })
      );
    },
    [productsQuery.data]
  );

  function validateEntry(): BatchItemInput[] | null {
    setPreviewError(null);
    const validLocalItems = items
      .filter((item) => item.productName.trim() || item.productId)
      .map(normalizeItem);

    if (!batchName.trim()) {
      const message = "Informe o nome da entrada.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    if (validLocalItems.length === 0) {
      const message = "Adicione pelo menos 1 produto na entrada.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    const negativeAdditional = [
      ["custo operacional", totalOperationalCost],
      ["impostos/taxas", totalTaxCost],
      ["outros custos", totalOtherCost],
    ].find(([, value]) => toMoney(String(value)) < 0);

    if (negativeAdditional) {
      const message = `O campo ${negativeAdditional[0]} não pode ser negativo.`;
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    for (const [index, item] of validLocalItems.entries()) {
      const position = index + 1;
      if (!item.productName.trim()) {
        const message = `Produto ${position}: informe o nome do produto.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.entryMode === "EXISTING" && !item.productId) {
        const message = `Produto ${position}: selecione um produto existente ou altere o tipo para Novo.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.quantityNumber <= 0) {
        const message = `Produto ${position}: informe uma quantidade maior que zero.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.unitCostBrl <= 0) {
        const message = `Produto ${position}: informe um custo unitário maior que zero.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.currency === "USD" && item.exchangeRateNumber <= 0) {
        const message = `Produto ${position}: informe a cotação do dólar.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }
    }

    const batchItems = validLocalItems.map((item) => toBatchItem(item));
    const goodsTotal = batchItems.reduce((sum, item) => sum + item.unitCostBrl * item.quantity, 0);
    if (goodsTotal <= 0) {
      const message = "O custo total das mercadorias precisa ser maior que zero.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    return batchItems;
  }

  const calculatePreview = useCallback(
    (showToast = false): BatchPricingResult | null => {
      const validItems = validateEntry();
      if (!validItems) return null;

      const result = calculateBatchPricing({
        items: validItems,
        totalOperationalCost: toMoney(totalOperationalCost),
        totalTaxCost: toMoney(totalTaxCost),
        totalOtherCost: toMoney(totalOtherCost),
      });

      if (isBatchPricingError(result)) {
        setPreview(null);
        setPreviewError(result.message);
        toast.error(result.message);
        return null;
      }

      setPreview(result);
      setPreviewError(null);
      if (showToast) toast.success("Rateio atualizado.");
      return result;
    },
    [items, totalOperationalCost, totalTaxCost, totalOtherCost, batchName]
  );

  const handlePreview = () => calculatePreview(true);

  const exportSpreadsheet = async () => {
    const currentPreview = preview ?? calculatePreview(false);
    if (!currentPreview) return;

    try {
      const XLSX = await import("xlsx");
      const now = new Date();
      const normalizedItems = items.map(normalizeItem);

      const summaryRows = [
        ["Nome da entrada", batchName.trim()],
        ["Data de exportação", now.toLocaleString("pt-BR")],
        ["Custo operacional total", currentPreview.totalOperationalCost],
        ["Impostos/taxas total", currentPreview.totalTaxCost],
        ["Outros custos total", currentPreview.totalOtherCost],
        ["Custo total das mercadorias", currentPreview.totalCostOfGoods],
        ["Custo total da entrada", currentPreview.grandTotal],
        ["Quantidade total de unidades", currentPreview.items.reduce((sum, item) => sum + item.quantity, 0)],
        ["Quantidade de tipos de produto", currentPreview.items.length],
        ["Modo FIFO ativo", fifoMode ? "Sim" : "Não"],
        ["Status", "Preview exportado"],
        ["Descrição", batchDescription.trim()],
      ];

      const productsRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        Categoria:
          normalizedItems.find((localItem) => localItem.productName === item.productName)?.category ?? "",
        Quantidade: item.quantity,
        Moeda: item.costCurrency ?? "BRL",
        "Custo original": item.unitCostOriginal ?? item.unitCostBrl,
        Cotação: item.exchangeRate ?? 0,
        "Custo unitário BRL": item.unitCostBrl,
        "Custo base total": item.totalItemCost,
        "Forma de pagamento da compra": item.acquisitionPaymentMethod ?? "OUTRO",
      }));

      const allocationRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        Quantidade: item.quantity,
        "Proporção na entrada": item.costProportion,
        "Custo operacional rateado": item.allocatedOperationalCost,
        "Imposto rateado": item.allocatedTaxCost,
        "Outros custos rateados": item.allocatedOtherCost,
        "Custo operacional por unidade": item.operationalCostPerUnit,
        "Imposto por unidade": item.taxCostPerUnit,
        "Outros custos por unidade": item.otherCostPerUnit,
        "Custo real unitário": item.finalUnitCost,
        "Custo real total": item.realTotalCost,
      }));

      const projectionRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        "Custo real unitário": item.finalUnitCost,
        "Margem tipo": "Percentual",
        "Margem valor": item.desiredMarginRate,
        "Preço sugerido": item.suggestedPrice,
        "Lucro unitário": item.contributionMargin,
        "Lucro total estimado": item.contributionMargin * item.quantity,
      }));

      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      const productsSheet = XLSX.utils.json_to_sheet(productsRows);
      const allocationSheet = XLSX.utils.json_to_sheet(allocationRows);
      const projectionSheet = XLSX.utils.json_to_sheet(projectionRows);

      const setWidths = (sheet: any, widths: number[]) => {
        sheet["!cols"] = widths.map((wch) => ({ wch }));
      };

      setWidths(summarySheet, [32, 42]);
      setWidths(productsSheet, [14, 36, 18, 12, 10, 16, 10, 18, 18, 26]);
      setWidths(allocationSheet, [14, 36, 12, 18, 24, 18, 22, 26, 20, 24, 20, 18]);
      setWidths(projectionSheet, [14, 36, 20, 16, 14, 18, 16, 20]);

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo da Entrada");
      XLSX.utils.book_append_sheet(workbook, productsSheet, "Produtos da Entrada");
      XLSX.utils.book_append_sheet(workbook, allocationSheet, "Rateio e Custos");
      XLSX.utils.book_append_sheet(workbook, projectionSheet, "Margem e Lucro");

      XLSX.writeFile(workbook, `${cleanFileName(batchName)}-${Date.now()}.xlsx`);
      toast.success("Planilha exportada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível exportar a planilha.");
    }
  };

  const handleSaveAndProcess = async (commitToStock: boolean) => {
    const validItemsForPreview = validateEntry();
    if (!validItemsForPreview) return;

    const result = calculatePreview(false);
    if (!result) return;

    try {
      const validLocalItems = items
        .filter((item) => item.productName.trim() || item.productId)
        .map(normalizeItem);

      const preparedItems: LocalItem[] = [];

      for (const item of validLocalItems) {
        if (item.productId) {
          preparedItems.push(item);
          continue;
        }

        if (item.entryMode !== "NEW") {
          throw new Error(
            `Selecione um produto existente ou marque como produto novo: ${item.productName}.`
          );
        }

        const newProduct = await createProduct.mutateAsync({
          name: item.productName.trim(),
          category: item.category,
          costPrice: item.unitCostBrl,
          packagingCost: 0,
          inboundShippingCost: 0,
          operationalCost: 0,
          desiredMarginRate: item.desiredMarginRateNumber,
          desiredMarginValue: 0,
          marginMode: "PERCENT",
          taxRegime: "SIMPLES_NACIONAL",
          estimatedTaxRate: item.estimatedTaxRateNumber,
          active: true,
          published: false,
          costCurrency: item.currency,
          costPriceUsd: item.currency === "USD" ? item.unitCostOriginalNumber : 0,
          usdExchangeRate: item.currency === "USD" ? item.exchangeRateNumber : 0,
          stockQuantity: 0,
          minimumStock: 0,
          shortDescription: "",
          description: "",
          categoryLabel: "",
          notes: `Produto criado pela Entrada de Produtos. Pagamento da aquisição: ${item.acquisitionPaymentMethod}.`,
        });

        preparedItems.push({ ...item, productId: newProduct.id });
      }

      setItems((prev) =>
        prev.map((current) => {
          const prepared = preparedItems.find((item) => item._id === current._id);
          return prepared
            ? {
                ...current,
                productId: prepared.productId,
                productName: prepared.productName,
              }
            : current;
        })
      );

      const validItems = preparedItems.map(toBatchItem);

      let batchId = savedBatchId;
      if (!batchId) {
        const batch = await createBatch.mutateAsync({
          name: batchName.trim(),
          description: batchDescription.trim() || undefined,
          totalOperationalCost: toMoney(totalOperationalCost),
          totalTaxCost: toMoney(totalTaxCost),
          totalOtherCost: toMoney(totalOtherCost),
        });
        batchId = batch.id;
      }

      if (fifoMode) {
        await processFIFO.mutateAsync({
          batchId,
          items: validItems,
          totalOperationalCost: toMoney(totalOperationalCost),
          totalTaxCost: toMoney(totalTaxCost),
          totalOtherCost: toMoney(totalOtherCost),
        });
      } else {
        await processBatch.mutateAsync({
          batchId,
          items: validItems,
          totalOperationalCost: toMoney(totalOperationalCost),
          totalTaxCost: toMoney(totalTaxCost),
          totalOtherCost: toMoney(totalOtherCost),
          commitToStock,
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar entrada.");
    }
  };

  const isLoading =
    createProduct.isPending || createBatch.isPending || processBatch.isPending || processFIFO.isPending;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/entrada-produtos")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova Entrada de Produtos</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Registre produto novo ou existente, calcule custo real com rateio proporcional,
              alimente estoque/FIFO e exporte a planilha da entrada.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => calculatePreview(true)}>
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Rateio
          </Button>
          <Button variant="outline" onClick={exportSpreadsheet}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Planilha
          </Button>
        </div>
      </div>

      {fifoResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Entrada FIFO processada com sucesso
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  <strong>{fifoResult.activatedCount}</strong> produto(s) ativados
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <strong>{fifoResult.queuedCount}</strong> na fila de espera
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados da Entrada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Entrada</CardTitle>
          <CardDescription>
            Informe os custos totais da compra. Eles serão distribuídos proporcionalmente pelo valor financeiro de cada produto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Nome da entrada" required>
              <Input
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="Ex: Importação Maio/26"
                className="h-10"
              />
            </Field>
            <Field label="Custo operacional total" hint="Frete, despachante, armazenamento.">
              <TextNumberInput
                value={totalOperationalCost}
                onChange={setTotalOperationalCost}
                placeholder="Ex: 4500,00"
              />
            </Field>
            <Field label="Impostos / taxas da entrada">
              <TextNumberInput
                value={totalTaxCost}
                onChange={setTotalTaxCost}
                placeholder="Ex: 1200,00"
              />
            </Field>
            <Field label="Outros custos da entrada">
              <TextNumberInput
                value={totalOtherCost}
                onChange={setTotalOtherCost}
                placeholder="Ex: 300,00"
              />
            </Field>
          </div>

          <Field label="Descrição">
            <Textarea
              value={batchDescription}
              onChange={(event) => setBatchDescription(event.target.value)}
              placeholder="Observações, fornecedor, número de nota, origem da compra..."
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {/* FIFO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Configuração FIFO
          </CardTitle>
          <CardDescription>
            Mantém histórico de entrada e coloca estoque novo em fila quando já houver saldo ativo do mesmo produto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`rounded-xl border p-4 ${fifoMode ? "border-primary/40 bg-primary/5" : "border-border"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-semibold" htmlFor="fifo-toggle">
                    Processar com fila FIFO
                  </Label>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    Recomendado
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground max-w-3xl">
                  Produto sem estoque entra como ativo. Produto com estoque entra em espera e será promovido quando o estoque atual zerar.
                </p>
              </div>
              <Switch id="fifo-toggle" checked={fifoMode} onCheckedChange={setFifoMode} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Produtos da Entrada</CardTitle>
            <CardDescription>
              Cada produto fica em um card para evitar rolagem lateral e facilitar preenchimento.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addItem}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => {
            const normalized = normalizeItem(item);
            const baseTotal = normalized.unitCostBrl * normalized.quantityNumber;
            const selectedProduct = productsQuery.data?.find((product: any) => product.id === item.productId) as any;

            return (
              <div key={item._id} className="rounded-2xl border border-border bg-muted/10 p-4 space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Item {index + 1}</Badge>
                      {item.productId && <Badge variant="secondary">ID #{item.productId}</Badge>}
                      <Badge variant={item.entryMode === "NEW" ? "default" : "secondary"}>
                        {item.entryMode === "NEW" ? "Produto novo" : "Produto existente"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.entryMode === "NEW"
                        ? "Será criado como rascunho e receberá a entrada de estoque."
                        : "Usa o ID existente e não duplica produto."}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive md:self-start"
                    onClick={() => removeItem(item._id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                </div>

                {/* Linha 1 */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Tipo" required>
                    <select
                      value={item.entryMode}
                      onChange={(event) => {
                        const mode = event.target.value as EntryMode;
                        updateItem(item._id, "entryMode", mode);
                        if (mode === "NEW") updateItem(item._id, "productId", undefined);
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="EXISTING">Produto existente</option>
                      <option value="NEW">Produto novo</option>
                    </select>
                  </Field>

                  <Field label="Produto existente" hint="Use para não duplicar cadastro.">
                    <select
                      value={item.productId ?? ""}
                      onChange={(event) => applyExistingProduct(item._id, event.target.value)}
                      disabled={item.entryMode === "NEW" || productsQuery.isLoading}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                    >
                      <option value="">
                        {productsQuery.isLoading ? "Carregando produtos..." : "Selecionar produto"}
                      </option>
                      {productsQuery.data?.map((product: any) => (
                        <option key={product.id} value={product.id}>
                          #{product.id} — {product.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Nome do produto" required>
                      <Input
                        value={item.productName}
                        onChange={(event) => updateItem(item._id, "productName", event.target.value)}
                        placeholder={item.entryMode === "NEW" ? "Ex: ONE MILLION ELIXIR 100ML" : "Produto selecionado"}
                        className="h-10 text-sm"
                      />
                    </Field>
                  </div>

                  <Field label="Categoria" required>
                    <select
                      value={item.category}
                      onChange={(event) => updateItem(item._id, "category", event.target.value as ProductCategory)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Linha 2 */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Moeda" required>
                    <select
                      value={item.currency}
                      onChange={(event) => updateItem(item._id, "currency", event.target.value as AcquisitionCurrency)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="BRL">Real (BRL)</option>
                      <option value="USD">Dólar (USD)</option>
                    </select>
                  </Field>

                  <Field label="Custo original" required>
                    <TextNumberInput
                      value={item.unitCostOriginal}
                      onChange={(value) => updateItem(item._id, "unitCostOriginal", value)}
                      placeholder={item.currency === "USD" ? "Ex: 20,00" : "Ex: 110,00"}
                    />
                  </Field>

                  <Field label="Cotação" hint={item.currency === "USD" ? "Obrigatória para dólar." : "Usada somente em USD."}>
                    <TextNumberInput
                      value={item.currency === "USD" ? item.exchangeRate : ""}
                      onChange={(value) => updateItem(item._id, "exchangeRate", value)}
                      placeholder="Ex: 5,50"
                      disabled={item.currency !== "USD"}
                    />
                  </Field>

                  <Field label="Custo unitário BRL">
                    <ReadOnlyMoney value={normalized.unitCostBrl} />
                  </Field>

                  <Field label="Quantidade" required>
                    <TextNumberInput
                      value={item.quantity}
                      onChange={(value) => updateItem(item._id, "quantity", value)}
                      placeholder="Ex: 80"
                      integer
                      className="min-w-[120px] font-semibold"
                    />
                  </Field>
                </div>

                {/* Linha 3 */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Pagamento da compra" hint="Não altera pagamento da venda ao cliente.">
                    <select
                      value={item.acquisitionPaymentMethod}
                      onChange={(event) =>
                        updateItem(
                          item._id,
                          "acquisitionPaymentMethod",
                          event.target.value as AcquisitionPaymentMethod
                        )
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {PAYMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Margem % para projeção">
                    <TextNumberInput
                      value={item.desiredMarginRate}
                      onChange={(value) => updateItem(item._id, "desiredMarginRate", value)}
                      placeholder="Ex: 30"
                    />
                  </Field>

                  <Field label="Imposto % venda sugerida">
                    <TextNumberInput
                      value={item.estimatedTaxRate}
                      onChange={(value) => updateItem(item._id, "estimatedTaxRate", value)}
                      placeholder="Ex: 6"
                    />
                  </Field>
                </div>

                {/* Resumo calculado do item */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                  <SummaryBox label="Custo base" value={formatCurrency(baseTotal)} />
                  <SummaryBox label="Custo unit. BRL" value={displayMoneyOrEmpty(normalized.unitCostBrl) || "—"} />
                  <SummaryBox label="Quantidade" value={normalized.quantityNumber > 0 ? String(normalized.quantityNumber) : "—"} />
                  <SummaryBox
                    label="Pagamento"
                    value={PAYMENT_OPTIONS.find((option) => option.value === item.acquisitionPaymentMethod)?.label ?? "—"}
                  />
                  <SummaryBox label="Produto" value={selectedProduct ? `#${selectedProduct.id}` : item.entryMode === "NEW" ? "Novo" : "—"} />
                  <SummaryBox label="Moeda" value={item.currency} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Resumo financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletCards className="h-4 w-4" />
            Resumo Financeiro da Entrada
          </CardTitle>
          <CardDescription>Resumo rápido antes do rateio final.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryBox label="Tipos de produto" value={String(totals.productTypes)} />
            <SummaryBox label="Unidades totais" value={String(totals.totalQuantity || "—")} />
            <SummaryBox label="Mercadorias" value={formatCurrency(totals.goodsTotal)} />
            <SummaryBox label="Custos adicionais" value={formatCurrency(totals.additionalTotal)} />
            <SummaryBox label="Total da entrada" value={formatCurrency(totals.grandTotal)} />
          </div>
        </CardContent>
      </Card>

      {previewError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {previewError}
        </div>
      )}

      {preview && <BatchPreviewCards preview={preview} />}

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={exportSpreadsheet}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Planilha
        </Button>
        <Button variant="outline" onClick={() => calculatePreview(true)}>
          <Calculator className="mr-2 h-4 w-4" />
          Atualizar Preview
        </Button>
        {fifoMode ? (
          <Button onClick={() => setShowCommitDialog(true)} disabled={isLoading}>
            <Clock className="mr-2 h-4 w-4" />
            Processar Entrada com Fila FIFO
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => handleSaveAndProcess(false)} disabled={isLoading}>
              Salvar Entrada sem Estoque
            </Button>
            <Button onClick={() => setShowCommitDialog(true)} disabled={isLoading}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Processar e Dar Entrada no Estoque
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fifoMode ? "Confirmar processamento FIFO" : "Confirmar entrada de estoque"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {fifoMode ? (
                  <>
                    <p>
                      A entrada será processada com <strong>Fila FIFO</strong>. Produto com estoque atual entra na fila; produto sem estoque entra ativo.
                    </p>
                    <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      A entrada será fechada após o processamento.
                    </p>
                  </>
                ) : (
                  <p>
                    Isso atualiza estoque dos produtos vinculados e calcula custo médio ponderado.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCommitDialog(false);
                handleSaveAndProcess(true);
              }}
            >
              {fifoMode ? "Confirmar FIFO" : "Confirmar Entrada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Resultado do rateio em cards ─────────────────────────────────────────────

function BatchPreviewCards({ preview }: { preview: BatchPricingResult }) {
  const totalSuggestedRevenue = preview.items.reduce(
    (sum, item) => sum + item.suggestedPrice * item.quantity,
    0
  );
  const totalProjectedProfit = preview.items.reduce(
    (sum, item) => sum + item.contributionMargin * item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base text-primary">Resultado do Rateio Proporcional</CardTitle>
          <CardDescription>
            Custos adicionais de <strong>{formatCurrency(preview.totalOperationalCost + preview.totalTaxCost + preview.totalOtherCost)}</strong> rateados sobre <strong>{formatCurrency(preview.totalCostOfGoods)}</strong> em mercadorias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryBox label="Mercadorias" value={formatCurrency(preview.totalCostOfGoods)} />
            <SummaryBox label="Operacional" value={formatCurrency(preview.totalOperationalCost)} />
            <SummaryBox label="Impostos/taxas" value={formatCurrency(preview.totalTaxCost)} />
            <SummaryBox label="Outros custos" value={formatCurrency(preview.totalOtherCost)} />
            <SummaryBox label="Total da entrada" value={formatCurrency(preview.grandTotal)} />
            <SummaryBox label="Receita projetada" value={formatCurrency(totalSuggestedRevenue)} />
            <SummaryBox label="Lucro projetado" value={formatCurrency(totalProjectedProfit)} />
            <SummaryBox
              label="Conferência do rateio"
              value={
                Math.abs(preview.allocationCheck - preview.totalOperationalCost) < 0.01 &&
                Math.abs(preview.taxAllocationCheck - preview.totalTaxCost) < 0.01 &&
                Math.abs(preview.otherAllocationCheck - preview.totalOtherCost) < 0.01
                  ? "OK"
                  : "Verificar"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {preview.items.map((item, index) => (
          <Card key={`${item.productId ?? "novo"}-${item.productName}-${index}`}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant="outline">#{index + 1}</Badge>
                    {item.productId && <Badge variant="secondary">ID {item.productId}</Badge>}
                    <span>{item.productName}</span>
                  </CardTitle>
                  <CardDescription>
                    Proporção na entrada: <strong>{formatPercent(item.costProportion * 100)}</strong>
                  </CardDescription>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Custo real unitário</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(item.finalUnitCost)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <SummaryBox label="Quantidade" value={String(item.quantity)} />
                <SummaryBox label="Moeda" value={item.costCurrency ?? "BRL"} />
                <SummaryBox label="Custo original" value={formatCurrency(item.unitCostOriginal ?? item.unitCostBrl)} />
                <SummaryBox label="Cotação" value={item.exchangeRate ? String(item.exchangeRate) : "—"} />
                <SummaryBox label="Custo unit. BRL" value={formatCurrency(item.unitCostBrl)} />
                <SummaryBox label="Custo base total" value={formatCurrency(item.baseTotalCost ?? item.totalItemCost)} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SummaryBox
                  label="Operacional rateado"
                  value={formatCurrency(item.allocatedOperationalCost)}
                  hint={`${formatCurrency(item.operationalCostPerUnit)} por unidade`}
                />
                <SummaryBox
                  label="Imposto rateado"
                  value={formatCurrency(item.allocatedTaxCost)}
                  hint={`${formatCurrency(item.taxCostPerUnit)} por unidade`}
                />
                <SummaryBox
                  label="Outros custos rateados"
                  value={formatCurrency(item.allocatedOtherCost)}
                  hint={`${formatCurrency(item.otherCostPerUnit)} por unidade`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <SummaryBox label="Custo real total" value={formatCurrency(item.realTotalCost)} />
                <SummaryBox label="Preço sugerido" value={formatCurrency(item.suggestedPrice)} />
                <SummaryBox label="Lucro unitário proj." value={formatCurrency(item.contributionMargin)} />
                <SummaryBox
                  label="Lucro total proj."
                  value={formatCurrency(item.contributionMargin * item.quantity)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
