/**
 * BatchPricing.tsx — Página de Criação de Lote e Rateio de Custos
 *
 * Rota: /lotes/novo  e  /lotes/:id
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { PlusCircle, Trash2, Calculator, PackageCheck, ChevronLeft } from "lucide-react";
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

interface LocalItem extends BatchItemInput {
  _id: string; // chave local
}

const emptyItem = (): LocalItem => ({
  _id: crypto.randomUUID(),
  productName: "",
  unitCostBrl: 0,
  quantity: 1,
  desiredMarginRate: 30,
  estimatedTaxRate: 6,
});

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BatchPricing() {
  const [, setLocation] = useLocation();

  // Cabeçalho do lote
  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [totalOperationalCost, setTotalOperationalCost] = useState(0);

  // Itens
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);

  // Resultado do cálculo (preview local, sem persistir)
  const [preview, setPreview] = useState<BatchPricingResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Confirmação de commit
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: (batch) => {
      setSavedBatchId(batch.id);
    },
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

  // ── Calcular preview (lado do cliente, sem persistir) ───────────────────────

  const handlePreview = () => {
    setPreviewError(null);
    setPreview(null);

    const validItems = items.filter((i) => i.productName.trim());
    if (validItems.length === 0) {
      setPreviewError("Adicione pelo menos 1 item com nome preenchido.");
      return;
    }

    const result = calculateBatchPricing({
      items: validItems,
      totalOperationalCost,
    });

    if (isBatchPricingError(result)) {
      setPreviewError(result.message);
    } else {
      setPreview(result);
    }
  };

  // ── Salvar lote e processar ─────────────────────────────────────────────────

  const handleSaveAndProcess = async (commitToStock: boolean) => {
    if (!batchName.trim()) {
      toast.error("Informe o nome do lote.");
      return;
    }

    const validItems = items.filter((i) => i.productName.trim());
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos 1 item.");
      return;
    }

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

      await processBatch.mutateAsync({
        batchId,
        items: validItems.map(({ _id, ...item }) => item),
        totalOperationalCost,
        commitToStock,
      });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar lote.");
    }
  };

  const isLoading = createBatch.isPending || processBatch.isPending;

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
            O custo operacional será rateado proporcionalmente ao valor de cada item.
          </p>
        </div>
      </div>

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
              type="number"
              min={0}
              step={0.01}
              value={totalOperationalCost}
              onChange={(e) => setTotalOperationalCost(Number(e.target.value))}
              placeholder="Ex: 1000.00"
            />
            <p className="text-xs text-muted-foreground">
              Frete, despachante, armazenagem, taxas aduaneiras — tudo o que custou para trazer o lote.
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
        </CardContent>
      </Card>

      {/* Tabela de Itens */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Itens do Lote</CardTitle>
            <CardDescription>
              Preencha o custo unitário em BRL (converta antes se USD).
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
                <TableHead className="w-[220px]">Produto</TableHead>
                <TableHead className="w-[120px]">Custo Unit. (R$)</TableHead>
                <TableHead className="w-[80px]">Qtd</TableHead>
                <TableHead className="w-[100px]">Margem %</TableHead>
                <TableHead className="w-[100px]">Imposto %</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <Input
                      value={item.productName}
                      onChange={(e) =>
                        updateItem(item._id, "productName", e.target.value)
                      }
                      placeholder="Nome do produto"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitCostBrl}
                      onChange={(e) =>
                        updateItem(item._id, "unitCostBrl", e.target.value)
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item._id, "quantity", e.target.value)
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      step={0.5}
                      value={item.desiredMarginRate}
                      onChange={(e) =>
                        updateItem(item._id, "desiredMarginRate", e.target.value)
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      step={0.1}
                      value={item.estimatedTaxRate ?? 6}
                      onChange={(e) =>
                        updateItem(item._id, "estimatedTaxRate", e.target.value)
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
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
        </CardContent>
      </Card>

      {/* Ação: Calcular preview */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handlePreview}>
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Rateio (Preview)
        </Button>
      </div>

      {/* Erro de validação */}
      {previewError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
          {previewError}
        </div>
      )}

      {/* Preview dos resultados */}
      {preview && <BatchPreviewTable preview={preview} />}

      {/* Botões de ação */}
      <Separator />
      <div className="flex flex-col sm:flex-row justify-end gap-3">
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
      </div>

      {/* Dialog de confirmação de entrada */}
      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Entrada de Estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá atualizar o estoque de cada produto vinculado com as quantidades
              informadas e calcular o custo médio ponderado. Esta ação fechará o lote
              e não poderá ser desfeita.
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
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Subcomponente: Preview da tabela de rateio ────────────────────────────────

function BatchPreviewTable({ preview }: { preview: BatchPricingResult }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-base text-primary">
          Resultado do Rateio Proporcional
        </CardTitle>
        <CardDescription>
          Custo operacional total de{" "}
          <strong>{formatCurrency(preview.totalOperationalCost)}</strong> rateado sobre{" "}
          <strong>{formatCurrency(preview.totalCostOfGoods)}</strong> em mercadorias.
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
            { label: "Custo Operacional", value: formatCurrency(preview.totalOperationalCost) },
            { label: "Total do Lote", value: formatCurrency(preview.grandTotal) },
            {
              label: "Verificação (rateio)",
              value: formatCurrency(preview.allocationCheck),
              note: Math.abs(preview.allocationCheck - preview.totalOperationalCost) < 0.01
                ? "✓ Correto"
                : "⚠ Divergência",
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
