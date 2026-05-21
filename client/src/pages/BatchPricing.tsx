/**
 * BatchPricing.tsx — Entrada de Produtos com Rateio Proporcional + FIFO
 *
 * Esta tela é a base operacional da Entrada de Produtos.
 * Ela permite registrar entrada para produto existente ou criar um produto base
 * antes de processar estoque, preservando compatibilidade com produtos antigos.
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  PlusCircle, Trash2, Calculator, PackageCheck, ChevronLeft,
  Clock, Zap, Info, CheckCircle2, AlertTriangle, PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateBatchPricing, formatCurrency, formatPercent,
  isBatchPricingError, type BatchItemInput, type BatchPricingResult,
} from "@shared/pricing.batch";
import { CurrencyInput } from "@/components/CurrencyInput";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type EntryMode = "EXISTING" | "NEW";
type AcquisitionCurrency = "BRL" | "USD";
type AcquisitionPaymentMethod = "DINHEIRO" | "PIX" | "BOLETO" | "CARTAO" | "DOLAR" | "OUTRO";
type ProductCategory = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";

interface LocalItem extends BatchItemInput {
  _id: string;
  entryMode: EntryMode;
  category: ProductCategory;
  currency: AcquisitionCurrency;
  unitCostOriginal: number;
  exchangeRate: number;
  acquisitionPaymentMethod: AcquisitionPaymentMethod;
}

const emptyItem = (): LocalItem => ({
  _id: crypto.randomUUID(),
  entryMode: "EXISTING",
  productName: "",
  productId: undefined,
  category: "OUTRO",
  currency: "BRL",
  unitCostOriginal: 0,
  exchangeRate: 5.5,
  unitCostBrl: 0,
  quantity: 1,
  desiredMarginRate: 30,
  estimatedTaxRate: 6,
  acquisitionPaymentMethod: "PIX",
});

function resolveUnitCostBrl(item: LocalItem): number {
  const original = Number(item.unitCostOriginal || 0);
  if (item.currency === "USD") return original * Number(item.exchangeRate || 0);
  return original;
}

function normalizeItem(item: LocalItem): LocalItem {
  return {
    ...item,
    unitCostOriginal: Number(item.unitCostOriginal || 0),
    exchangeRate: Number(item.exchangeRate || 0),
    unitCostBrl: resolveUnitCostBrl(item),
    quantity: Number(item.quantity || 0),
    desiredMarginRate: Number(item.desiredMarginRate || 0),
    estimatedTaxRate: Number(item.estimatedTaxRate ?? 0),
  };
}

function toBatchItem(item: LocalItem): BatchItemInput {
  const normalized = normalizeItem(item);
  return {
    productId: normalized.productId,
    productName: normalized.productName,
    unitCostOriginal: normalized.unitCostOriginal,
    costCurrency: normalized.currency,
    exchangeRate: normalized.currency === "USD" ? normalized.exchangeRate : 0,
    acquisitionPaymentMethod: normalized.acquisitionPaymentMethod,
    unitCostBrl: normalized.unitCostBrl,
    quantity: normalized.quantity,
    desiredMarginRate: normalized.desiredMarginRate,
    estimatedTaxRate: normalized.estimatedTaxRate,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BatchPricing() {
  const [, setLocation] = useLocation();

  // Cabeçalho
  const [batchName, setBatchName]               = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [totalOperationalCost, setTotalOperationalCost] = useState(0);
  const [totalTaxCost, setTotalTaxCost] = useState(0);
  const [totalOtherCost, setTotalOtherCost] = useState(0);

  // Modo FIFO
  const [fifoMode, setFifoMode] = useState(false);

  // Itens
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);

  // Preview
  const [preview, setPreview]           = useState<BatchPricingResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Dialogs
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [savedBatchId, setSavedBatchId]         = useState<number | null>(null);
  const [fifoResult, setFifoResult]             = useState<{ queuedCount: number; activatedCount: number } | null>(null);

  const utils = trpc.useUtils();

  const productsQuery = trpc.products.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

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

  // ── Handlers de itens ───────────────────────────────────────────────────────

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i._id !== id));

  const updateItem = useCallback(
    (id: string, field: keyof LocalItem, value: string | number | undefined) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== id) return item;
          const next: LocalItem = {
            ...item,
            [field]: typeof value === "string" ? value : value === undefined ? undefined : Number(value),
          } as LocalItem;

          if (field === "currency" || field === "unitCostOriginal" || field === "exchangeRate") {
            next.unitCostBrl = resolveUnitCostBrl(next);
          }

          return next;
        })
      );
    },
    []
  );

  const applyExistingProduct = useCallback((itemId: string, rawProductId: string) => {
    const selectedId = rawProductId ? Number(rawProductId) : undefined;
    const selected = productsQuery.data?.find((p: any) => p.id === selectedId) as any;

    setItems((prev) =>
      prev.map((item) => {
        if (item._id !== itemId) return item;
        if (!selected) {
          return { ...item, productId: undefined, entryMode: "EXISTING" };
        }

        const cost = Number(selected.finalUnitCostBrl ?? selected.averageCostBrl ?? selected.costPrice ?? 0);
        return {
          ...item,
          entryMode: "EXISTING",
          productId: selected.id,
          productName: selected.name ?? item.productName,
          category: (selected.category as ProductCategory) ?? item.category,
          currency: "BRL",
          unitCostOriginal: cost > 0 ? cost : item.unitCostOriginal,
          unitCostBrl: cost > 0 ? cost : item.unitCostBrl,
        };
      })
    );
  }, [productsQuery.data]);

  // ── Preview ─────────────────────────────────────────────────────────────────

  const handlePreview = () => {
    setPreviewError(null);
    setPreview(null);

    const validItems = items.filter((i) => i.productName.trim()).map(toBatchItem);
    if (validItems.length === 0) {
      setPreviewError("Adicione pelo menos 1 item com nome preenchido.");
      return;
    }

    const result = calculateBatchPricing({ items: validItems, totalOperationalCost, totalTaxCost, totalOtherCost });
    if (isBatchPricingError(result)) setPreviewError(result.message);
    else setPreview(result);
  };

  // ── Salvar + Processar ──────────────────────────────────────────────────────

  const handleSaveAndProcess = async (commitToStock: boolean) => {
    if (!batchName.trim()) { toast.error("Informe o nome da entrada."); return; }

    const validLocalItems = items.filter((i) => i.productName.trim()).map(normalizeItem);
    if (validLocalItems.length === 0) { toast.error("Adicione pelo menos 1 item."); return; }

    const invalidUsd = validLocalItems.find((i) => i.currency === "USD" && Number(i.exchangeRate || 0) <= 0);
    if (invalidUsd) {
      toast.error(`Informe a cotação do dólar para ${invalidUsd.productName}.`);
      return;
    }

    try {
      const preparedItems: LocalItem[] = [];
      for (const item of validLocalItems) {
        if (item.productId) {
          preparedItems.push(item);
          continue;
        }

        if (item.entryMode !== "NEW") {
          throw new Error(`Selecione um produto existente ou marque como produto novo: ${item.productName}.`);
        }

        const newProduct = await createProduct.mutateAsync({
          name: item.productName.trim(),
          category: item.category,
          costPrice: item.unitCostBrl,
          packagingCost: 0,
          inboundShippingCost: 0,
          operationalCost: 0,
          desiredMarginRate: item.desiredMarginRate,
          desiredMarginValue: 0,
          marginMode: "PERCENT",
          taxRegime: "SIMPLES_NACIONAL",
          estimatedTaxRate: item.estimatedTaxRate ?? 0,
          active: true,
          published: false,
          costCurrency: item.currency,
          costPriceUsd: item.currency === "USD" ? item.unitCostOriginal : 0,
          usdExchangeRate: item.currency === "USD" ? item.exchangeRate : 0,
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
          return prepared ?? current;
        })
      );

      const validItems = preparedItems.map(toBatchItem);

      let batchId = savedBatchId;
      if (!batchId) {
        const batch = await createBatch.mutateAsync({
          name: batchName.trim(),
          description: batchDescription.trim() || undefined,
          totalOperationalCost,
          totalTaxCost,
          totalOtherCost,
        });
        batchId = batch.id;
      }

      if (fifoMode) {
        // Modo FIFO — respeita estoque existente
        await processFIFO.mutateAsync({
          batchId,
          items: validItems,
          totalOperationalCost,
          totalTaxCost,
          totalOtherCost,
        });
      } else {
        // Modo padrão
        await processBatch.mutateAsync({
          batchId,
          items: validItems,
          totalOperationalCost,
          totalTaxCost,
          totalOtherCost,
          commitToStock,
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar entrada.");
    }
  };

  const isLoading = createProduct.isPending || createBatch.isPending || processBatch.isPending || processFIFO.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/entrada-produtos")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Entrada de Produtos</h1>
          <p className="text-sm text-muted-foreground">
            O custo operacional é rateado proporcionalmente ao valor de cada item.
          </p>
        </div>
      </div>

      {/* Resultado FIFO (após processar) */}
      {fifoResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Entrada FIFO processada com sucesso
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <strong>{fifoResult.activatedCount}</strong> produto(s) ativados imediatamente
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <strong>{fifoResult.queuedCount}</strong> na fila de espera (FIFO)
                </span>
              </div>
              <Button size="sm" onClick={() => setLocation("/entrada-produtos")} className="ml-auto">
                Ver entradas →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados da Entrada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Entrada</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Nome da entrada *</Label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Ex: Importação Shenzhen — Maio/26"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Custo Operacional Total (R$) *</Label>
            <CurrencyInput
              value={totalOperationalCost}
              onValueChange={setTotalOperationalCost}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Frete, despachante, armazenagem e custos gerais da entrada.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Impostos / Taxas da Entrada (R$)</Label>
            <CurrencyInput
              value={totalTaxCost}
              onValueChange={setTotalTaxCost}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Informe somente se houver imposto ou taxa da aquisição.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Outros Custos da Entrada (R$)</Label>
            <CurrencyInput
              value={totalOtherCost}
              onValueChange={setTotalOtherCost}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Qualquer custo adicional que deve compor o custo real.
            </p>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              placeholder="Detalhes da entrada…"
              rows={2}
            />
          </div>

          {/* Toggle FIFO */}
          <div className="md:col-span-3">
            <div className={`rounded-xl border p-4 transition-colors ${
              fifoMode ? "border-primary/40 bg-primary/5" : "border-border"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-semibold cursor-pointer" htmlFor="fifo-toggle">
                      Modo FIFO — Fila de Estoque por Entrada
                    </Label>
                    <Badge variant="secondary" className="text-[9px] tracking-wide uppercase">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                    Quando ativado, produtos que já possuem estoque ativo ficam em
                    <strong> fila de espera</strong>. O sistema promove automaticamente
                    a entrada mais antiga quando o estoque atual zera, atualizando custo
                    e preços de venda sem intervenção manual.
                  </p>

                  {/* Diagrama visual compacto */}
                  {fifoMode && (
                    <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                        Entrada A — ATIVA
                      </span>
                      <span className="text-muted-foreground">→ vende até zerar →</span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
                        Entrada B — EM ESPERA
                      </span>
                      <span className="text-muted-foreground">→ promovido automaticamente →</span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                        Entrada B — ATIVA ✓
                      </span>
                    </div>
                  )}
                </div>
                <Switch
                  id="fifo-toggle"
                  checked={fifoMode}
                  onCheckedChange={setFifoMode}
                  className="mt-0.5 shrink-0"
                />
              </div>

              {fifoMode && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                  <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    No modo FIFO, a entrada é sempre fechada automaticamente após processamento.
                    Produtos <strong>sem estoque</strong> ativo são ativados imediatamente.
                    Produtos <strong>com estoque</strong> entram na fila — o gatilho de virada
                    é disparado a cada venda registrada no sistema.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
            <PackagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Produto existente mantém o mesmo ID e recebe nova entrada de estoque. Produto novo é criado como rascunho
              não publicado e depois recebe a entrada. A forma de pagamento informada aqui é da compra, não da venda ao cliente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Itens */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Produtos da Entrada</CardTitle>
            <CardDescription>
              Selecione um produto existente ou marque como novo. A tela converte USD para BRL, calcula o rateio proporcional e usa o ID do produto para ativar estoque/FIFO sem duplicar cadastro.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addItem}>
            <PlusCircle className="w-4 h-4 mr-1" />
            Adicionar item
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Tipo</TableHead>
                <TableHead className="w-[220px]">Produto existente</TableHead>
                <TableHead className="w-[220px]">Nome</TableHead>
                <TableHead className="w-[130px]">Categoria</TableHead>
                <TableHead className="w-[95px]">Moeda</TableHead>
                <TableHead className="w-[120px]">Custo original</TableHead>
                <TableHead className="w-[100px]">Cotação</TableHead>
                <TableHead className="w-[120px]">Custo BRL</TableHead>
                <TableHead className="w-[70px]">Qtd</TableHead>
                <TableHead className="w-[105px]">Pagamento compra</TableHead>
                <TableHead className="w-[90px]">Margem %</TableHead>
                <TableHead className="w-[90px]">Imposto %</TableHead>
                <TableHead className="w-[36px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const unitCostBrl = resolveUnitCostBrl(item);
                return (
                  <TableRow key={item._id}>
                    <TableCell>
                      <select
                        value={item.entryMode}
                        onChange={(e) => {
                          const mode = e.target.value as EntryMode;
                          updateItem(item._id, "entryMode", mode);
                          if (mode === "NEW") updateItem(item._id, "productId", undefined);
                        }}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="EXISTING">Existente</option>
                        <option value="NEW">Novo</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      <select
                        value={item.productId ?? ""}
                        onChange={(e) => applyExistingProduct(item._id, e.target.value)}
                        disabled={item.entryMode === "NEW" || productsQuery.isLoading}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                        title="Selecione um produto já cadastrado para não duplicar"
                      >
                        <option value="">{productsQuery.isLoading ? "Carregando..." : "Selecionar"}</option>
                        {productsQuery.data?.map((product: any) => (
                          <option key={product.id} value={product.id}>
                            #{product.id} — {product.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={item.productName}
                        onChange={(e) => updateItem(item._id, "productName", e.target.value)}
                        placeholder={item.entryMode === "NEW" ? "Nome do produto novo" : "Nome do produto"}
                        className="h-8 text-sm"
                      />
                      {item.productId && (
                        <p className="mt-1 text-[10px] text-muted-foreground">ID vinculado: #{item.productId}</p>
                      )}
                    </TableCell>

                    <TableCell>
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(item._id, "category", e.target.value as ProductCategory)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="CELULAR">Celular</option>
                        <option value="ELETRONICO">Eletrônico</option>
                        <option value="PERFUME">Perfume</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      <select
                        value={item.currency}
                        onChange={(e) => updateItem(item._id, "currency", e.target.value as AcquisitionCurrency)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      <CurrencyInput
                        value={item.unitCostOriginal}
                        onValueChange={(v) => updateItem(item._id, "unitCostOriginal", v)}
                        noPrefix
                        placeholder="0,00"
                        size="sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number" min={0} step={0.01}
                        value={item.currency === "USD" ? item.exchangeRate : ""}
                        onChange={(e) => updateItem(item._id, "exchangeRate", e.target.value)}
                        disabled={item.currency !== "USD"}
                        placeholder="5.20"
                        className="h-8 text-sm disabled:opacity-50"
                      />
                    </TableCell>

                    <TableCell>
                      <CurrencyInput
                        value={unitCostBrl}
                        onValueChange={(v) => updateItem(item._id, "unitCostBrl", v)}
                        noPrefix
                        disabled
                        placeholder="0,00"
                        size="sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number" min={1} step={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item._id, "quantity", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <select
                        value={item.acquisitionPaymentMethod}
                        onChange={(e) => updateItem(item._id, "acquisitionPaymentMethod", e.target.value as AcquisitionPaymentMethod)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        title="Forma usada para comprar este item. Não altera o pagamento da venda."
                      >
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="PIX">Pix</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="CARTAO">Cartão</option>
                        <option value="DOLAR">Dólar</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number" min={0} max={99} step={0.5}
                        value={item.desiredMarginRate}
                        onChange={(e) => updateItem(item._id, "desiredMarginRate", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number" min={0} max={99} step={0.1}
                        value={item.estimatedTaxRate ?? 6}
                        onChange={(e) => updateItem(item._id, "estimatedTaxRate", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item._id)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Totais rápidos */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-3">
            <span>
              <strong className="text-foreground">{items.length}</strong> tipo(s) de produto
            </span>
            <span>
              <strong className="text-foreground">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </strong>{" "}
              unidades totais
            </span>
            <span>
              Custo das mercadorias:{" "}
              <strong className="text-foreground">
                {formatCurrency(items.reduce((s, i) => s + resolveUnitCostBrl(i) * i.quantity, 0))}
              </strong>
            </span>
            <span>
              Custos adicionais da entrada:{" "}
              <strong className="text-foreground">
                {formatCurrency(totalOperationalCost + totalTaxCost + totalOtherCost)}
              </strong>
            </span>
            <span>
              Total estimado:{" "}
              <strong className="text-foreground">
                {formatCurrency(items.reduce((s, i) => s + resolveUnitCostBrl(i) * i.quantity, 0) + totalOperationalCost + totalTaxCost + totalOtherCost)}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Ação: Preview */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handlePreview}>
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Rateio (Preview)
        </Button>
      </div>

      {previewError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
          {previewError}
        </div>
      )}

      {preview && <BatchPreviewTable preview={preview} />}

      {/* Botões de ação */}
      <Separator />
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        {fifoMode ? (
          /* Modo FIFO: único botão — sempre fecha e respeita estoque */
          <Button
            onClick={() => setShowCommitDialog(true)}
            disabled={isLoading}
            className="gap-2"
          >
            <Clock className="w-4 h-4" />
            Processar Entrada com Fila FIFO
          </Button>
        ) : (
          /* Modo padrão: dois botões */
          <>
            <Button
              variant="outline"
              onClick={() => handleSaveAndProcess(false)}
              disabled={isLoading}
            >
              Salvar Entrada (sem atualizar estoque)
            </Button>
            <Button
              onClick={() => setShowCommitDialog(true)}
              disabled={isLoading}
              className="gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              Processar e Dar Entrada no Estoque
            </Button>
          </>
        )}
      </div>

      {/* Dialog de confirmação */}
      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fifoMode ? "Confirmar Processamento FIFO" : "Confirmar Entrada de Estoque"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {fifoMode ? (
                  <>
                    <p>
                      A entrada será processada com a <strong>Fila FIFO</strong>.
                      O sistema irá verificar o estoque atual de cada produto:
                    </p>
                    <ul className="space-y-1.5 pl-4 list-disc">
                      <li>
                        <strong>Estoque ativo &gt; 0</strong> → produto entra na fila de espera.
                        Será ativado automaticamente quando o estoque atual zerar.
                      </li>
                      <li>
                        <strong>Estoque = 0</strong> → produto é ativado imediatamente com
                        os novos preços e custo desta entrada.
                      </li>
                    </ul>
                    <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      A entrada será fechada e não poderá ser editada após esta ação.
                    </p>
                  </>
                ) : (
                  <p>
                    Isso irá atualizar o estoque de cada produto vinculado com as
                    quantidades informadas e calcular o custo médio ponderado.
                    Esta ação fechará a entrada e não poderá ser desfeita.
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

// ─── Subcomponente: Preview do rateio ─────────────────────────────────────────

function BatchPreviewTable({ preview }: { preview: BatchPricingResult }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base text-primary">
          Resultado do Rateio Proporcional
        </CardTitle>
        <CardDescription>
          Custos adicionais de{" "}
          <strong>{formatCurrency(preview.totalOperationalCost + preview.totalTaxCost + preview.totalOtherCost)}</strong> rateados
          sobre <strong>{formatCurrency(preview.totalCostOfGoods)}</strong> em mercadorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Custo Unit.</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Custo Total Item</TableHead>
              <TableHead className="text-right">Proporção</TableHead>
              <TableHead className="text-right">Custo Op. Rateado</TableHead>
              <TableHead className="text-right">Imposto Rateado</TableHead>
              <TableHead className="text-right">Outros Rateados</TableHead>
              <TableHead className="text-right">Custo Final Unit.</TableHead>
              <TableHead className="text-right">Preço Sugerido Unit.</TableHead>
              <TableHead className="text-right">Preço Total (Qtd)</TableHead>
              <TableHead className="text-right">Margem Unit.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {item.productId && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-muted text-muted-foreground border border-border shrink-0">
                        #{item.productId}
                      </span>
                    )}
                    {item.productName}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(item.unitCostBrl)}
                </TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(item.totalItemCost)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    {formatPercent(item.costProportion * 100)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-orange-600 font-mono">
                  {formatCurrency(item.allocatedOperationalCost)}
                </TableCell>
                <TableCell className="text-right text-sm text-amber-600 font-mono">
                  {formatCurrency(item.allocatedTaxCost)}
                </TableCell>
                <TableCell className="text-right text-sm text-blue-600 font-mono">
                  {formatCurrency(item.allocatedOtherCost)}
                </TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(item.finalUnitCost)}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatCurrency(item.suggestedPrice)}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-600">
                  {formatCurrency(item.suggestedPrice * item.quantity)}
                </TableCell>
                <TableCell className="text-right text-sm text-green-600">
                  {formatCurrency(item.contributionMargin)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totais */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Custo das Mercadorias", value: formatCurrency(preview.totalCostOfGoods) },
            { label: "Custo Operacional", value: formatCurrency(preview.totalOperationalCost) },
            { label: "Impostos/Taxas", value: formatCurrency(preview.totalTaxCost) },
            { label: "Outros Custos", value: formatCurrency(preview.totalOtherCost) },
            { label: "Total da Entrada", value: formatCurrency(preview.grandTotal) },
            {
              label: "Verificação operacional",
              value: formatCurrency(preview.allocationCheck),
              note: Math.abs(preview.allocationCheck - preview.totalOperationalCost) < 0.01
                ? "✓ Correto" : "⚠ Divergência",
            },
            {
              label: "Verificação impostos",
              value: formatCurrency(preview.taxAllocationCheck),
              note: Math.abs(preview.taxAllocationCheck - preview.totalTaxCost) < 0.01
                ? "✓ Correto" : "⚠ Divergência",
            },
            {
              label: "Verificação outros",
              value: formatCurrency(preview.otherAllocationCheck),
              note: Math.abs(preview.otherAllocationCheck - preview.totalOtherCost) < 0.01
                ? "✓ Correto" : "⚠ Divergência",
            },
          ].map(({ label, value, note }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold font-mono">{value}</p>
              {note && <p className="text-xs text-green-600">{note}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
