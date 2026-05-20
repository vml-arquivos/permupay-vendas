/**
 * BatchPricing.tsx — Criação de Lote com Rateio Proporcional + FIFO
 *
 * NOVO: Toggle "Modo FIFO" — quando ativado, produtos com estoque ativo
 * entram na fila de espera e só são ativados quando o estoque atual zera.
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
  Clock, Zap, Info, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateBatchPricing, formatCurrency, formatPercent,
  isBatchPricingError, type BatchItemInput, type BatchPricingResult,
} from "@shared/pricing.batch";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface LocalItem extends BatchItemInput {
  _id: string;
}

const emptyItem = (): LocalItem => ({
  _id: crypto.randomUUID(),
  productName: "",
  unitCostBrl: 0,
  quantity: 1,
  desiredMarginRate: 30,
  estimatedTaxRate: 6,
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BatchPricing() {
  const [, setLocation] = useLocation();

  // Cabeçalho
  const [batchName, setBatchName]               = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [totalOperationalCost, setTotalOperationalCost] = useState(0);

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

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: (batch) => setSavedBatchId(batch.id),
  });

  const processBatch = trpc.batches.process.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      toast.success("Lote processado! Estoque atualizado.");
      setLocation("/lotes");
    },
    onError: (err) => toast.error(err.message),
  });

  const processFIFO = trpc.batches.processFIFO.useMutation({
    onSuccess: (data) => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      setFifoResult(data);
      toast.success(
        `Lote FIFO processado! ${data.activatedCount} ativado(s), ${data.queuedCount} na fila de espera.`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Handlers de itens ───────────────────────────────────────────────────────

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i._id !== id));

  const updateItem = useCallback(
    (id: string, field: keyof BatchItemInput, value: string | number) => {
      setItems((prev) =>
        prev.map((item) =>
          item._id === id
            ? { ...item, [field]: typeof value === "string" ? value : Number(value) }
            : item
        )
      );
    },
    []
  );

  // ── Preview ─────────────────────────────────────────────────────────────────

  const handlePreview = () => {
    setPreviewError(null);
    setPreview(null);

    const validItems = items.filter((i) => i.productName.trim());
    if (validItems.length === 0) {
      setPreviewError("Adicione pelo menos 1 item com nome preenchido.");
      return;
    }

    const result = calculateBatchPricing({ items: validItems, totalOperationalCost });
    if (isBatchPricingError(result)) setPreviewError(result.message);
    else setPreview(result);
  };

  // ── Salvar + Processar ──────────────────────────────────────────────────────

  const handleSaveAndProcess = async (commitToStock: boolean) => {
    if (!batchName.trim()) { toast.error("Informe o nome do lote."); return; }

    const validItems = items.filter((i) => i.productName.trim());
    if (validItems.length === 0) { toast.error("Adicione pelo menos 1 item."); return; }

    try {
      let batchId = savedBatchId;
      if (!batchId) {
        const batch = await createBatch.mutateAsync({
          name: batchName.trim(),
          description: batchDescription.trim() || undefined,
          totalOperationalCost,
        });
        batchId = batch.id;
      }

      if (fifoMode) {
        // Modo FIFO — respeita estoque existente
        await processFIFO.mutateAsync({
          batchId,
          items: validItems.map(({ _id, ...item }) => item),
          totalOperationalCost,
        });
      } else {
        // Modo padrão
        await processBatch.mutateAsync({
          batchId,
          items: validItems.map(({ _id, ...item }) => item),
          totalOperationalCost,
          commitToStock,
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar lote.");
    }
  };

  const isLoading = createBatch.isPending || processBatch.isPending || processFIFO.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/lotes")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Lote de Precificação</h1>
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
                  Lote FIFO processado com sucesso
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
              <Button size="sm" onClick={() => setLocation("/lotes")} className="ml-auto">
                Ver lotes →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados do Lote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Lote</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome do lote *</Label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Ex: Importação Shenzhen — Maio/26"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Custo Operacional Total (R$) *</Label>
            <Input
              type="number" min={0} step={0.01}
              value={totalOperationalCost}
              onChange={(e) => setTotalOperationalCost(Number(e.target.value))}
              placeholder="Ex: 1000.00"
            />
            <p className="text-xs text-muted-foreground">
              Frete, despachante, armazenagem, taxas aduaneiras — tudo para trazer o lote.
            </p>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              placeholder="Detalhes do lote…"
              rows={2}
            />
          </div>

          {/* Toggle FIFO */}
          <div className="md:col-span-2">
            <div className={`rounded-xl border p-4 transition-colors ${
              fifoMode ? "border-primary/40 bg-primary/5" : "border-border"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-semibold cursor-pointer" htmlFor="fifo-toggle">
                      Modo FIFO — Fila de Estoque por Lote
                    </Label>
                    <Badge variant="secondary" className="text-[9px] tracking-wide uppercase">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                    Quando ativado, produtos que já possuem estoque ativo ficam em
                    <strong> fila de espera</strong>. O sistema promove automaticamente
                    o lote mais antigo quando o estoque atual zera, atualizando custo
                    e preços de venda sem intervenção manual.
                  </p>

                  {/* Diagrama visual compacto */}
                  {fifoMode && (
                    <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                        Lote A — ATIVO
                      </span>
                      <span className="text-muted-foreground">→ vende até zerar →</span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
                        Lote B — EM ESPERA
                      </span>
                      <span className="text-muted-foreground">→ promovido automaticamente →</span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                        Lote B — ATIVO ✓
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
                    No modo FIFO, o lote é sempre fechado automaticamente após processamento.
                    Produtos <strong>sem estoque</strong> ativo são ativados imediatamente.
                    Produtos <strong>com estoque</strong> entram na fila — o gatilho de virada
                    é disparado a cada venda registrada no sistema.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Itens */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Itens do Lote</CardTitle>
            <CardDescription>
              Preencha o custo unitário em BRL (converta antes se USD).
              Vincule ao <strong>ID do produto</strong> para ativar o FIFO.
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
                <TableHead className="w-[200px]">Produto</TableHead>
                <TableHead className="w-[90px]">ID Produto</TableHead>
                <TableHead className="w-[110px]">Custo Unit. (R$)</TableHead>
                <TableHead className="w-[70px]">Qtd</TableHead>
                <TableHead className="w-[90px]">Margem %</TableHead>
                <TableHead className="w-[90px]">Imposto %</TableHead>
                <TableHead className="w-[36px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <Input
                      value={item.productName}
                      onChange={(e) => updateItem(item._id, "productName", e.target.value)}
                      placeholder="Nome do produto"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.productId ?? ""}
                      onChange={(e) =>
                        updateItem(item._id, "productId", e.target.value ? Number(e.target.value) : (undefined as any))
                      }
                      placeholder="ID"
                      className="h-8 text-sm"
                      title="ID do produto cadastrado (necessário para FIFO)"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} step={0.01}
                      value={item.unitCostBrl}
                      onChange={(e) => updateItem(item._id, "unitCostBrl", e.target.value)}
                      className="h-8 text-sm"
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
              ))}
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
                {formatCurrency(items.reduce((s, i) => s + i.unitCostBrl * i.quantity, 0))}
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
            Processar Lote com Fila FIFO
          </Button>
        ) : (
          /* Modo padrão: dois botões */
          <>
            <Button
              variant="outline"
              onClick={() => handleSaveAndProcess(false)}
              disabled={isLoading}
            >
              Salvar Lote (sem entrada no estoque)
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
                      O lote será processado com a <strong>Fila FIFO</strong>.
                      O sistema irá verificar o estoque atual de cada produto:
                    </p>
                    <ul className="space-y-1.5 pl-4 list-disc">
                      <li>
                        <strong>Estoque ativo &gt; 0</strong> → produto entra na fila de espera.
                        Será ativado automaticamente quando o estoque atual zerar.
                      </li>
                      <li>
                        <strong>Estoque = 0</strong> → produto é ativado imediatamente com
                        os novos preços e custo deste lote.
                      </li>
                    </ul>
                    <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      O lote será fechado e não poderá ser editado após esta ação.
                    </p>
                  </>
                ) : (
                  <p>
                    Isso irá atualizar o estoque de cada produto vinculado com as
                    quantidades informadas e calcular o custo médio ponderado.
                    Esta ação fechará o lote e não poderá ser desfeita.
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
          Custo operacional de{" "}
          <strong>{formatCurrency(preview.totalOperationalCost)}</strong> rateado
          sobre <strong>{formatCurrency(preview.totalCostOfGoods)}</strong> em mercadorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              <TableHead className="text-right">Proporção</TableHead>
              <TableHead className="text-right">Custo Op. Rateado</TableHead>
              <TableHead className="text-right">Custo Final Unit.</TableHead>
              <TableHead className="text-right">Preço Sugerido</TableHead>
              <TableHead className="text-right">Margem Unit.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {item.productName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    × {item.quantity}
                  </span>
                  {item.productId && (
                    <Badge variant="outline" className="ml-2 text-[9px]">
                      ID #{item.productId}
                    </Badge>
                  )}
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
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(item.finalUnitCost)}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatCurrency(item.suggestedPrice)}
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
            { label: "Custo Operacional",     value: formatCurrency(preview.totalOperationalCost) },
            { label: "Total do Lote",         value: formatCurrency(preview.grandTotal) },
            {
              label: "Verificação (rateio)",
              value: formatCurrency(preview.allocationCheck),
              note: Math.abs(preview.allocationCheck - preview.totalOperationalCost) < 0.01
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
