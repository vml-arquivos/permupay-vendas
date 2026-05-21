/**
 * Products.tsx — Gerenciamento de Produtos
 *
 * MUDANÇAS:
 * - Botão "Apagar" (exclusão permanente) com confirmação
 * - Botão "Ordenar Vitrine" para arrastar e reposicionar produtos
 * - Mantidos: Editar, Simular, Duplicar, Publicar/Despublicar, Desativar
 */

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Download,
  Plus,
  Edit2,
  Copy,
  Trash2,
  Eye,
  Search,
  AlertCircle,
  ShoppingBag,
  CreditCard,
  Globe,
  EyeOff,
  ImageOff,
  RefreshCw,
  Ban,
  Share2,
  GripVertical,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ProductView = "todos" | "publicados" | "rascunhos" | "paraPublicar";

export default function Products() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: pendingProducts = [] } = trpc.products.pendingToPublish.useQuery(undefined, {
    staleTime: 60_000,
  });
  // Settings globais — usadas como fallback para detectar links de pagamento
  // em produtos criados antes da herança automática ser implementada
  const { data: globalPayment } = trpc.paymentSettings.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<ProductView>("todos");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  // ── Ordenação drag-and-drop ──────────────────────────────────────────────────
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedProducts, setOrderedProducts] = useState<any[]>([]);
  const dragIndex = useRef<number | null>(null);

  const enterReorderMode = () => {
    // Publica e não publica: mostramos todos ativos, publicados primeiro para facilitar
    const all = (products as any[]).filter((p) => p.active);
    const sorted = [...all].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setOrderedProducts(sorted);
    setReorderMode(true);
  };

  const cancelReorder = () => {
    setReorderMode(false);
    setOrderedProducts([]);
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const updated = [...orderedProducts];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(index, 0, moved);
    dragIndex.current = index;
    setOrderedProducts(updated);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
  };

  const reorder = trpc.products.reorder.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setReorderMode(false);
      setOrderedProducts([]);
      toast.success("Ordem da vitrine salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveReorder = () => {
    reorder.mutate({ orderedIds: orderedProducts.map((p) => p.id) });
  };
  // ────────────────────────────────────────────────────────────────────────────

  const deactivate = trpc.products.deactivate.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto desativado.");
    },
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto removido permanentemente.");
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicate = trpc.products.duplicate.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto duplicado.");
    },
  });

  const togglePublished = trpc.products.togglePublished.useMutation({
    onSuccess: (updated: any) => {
      utils.products.list.invalidate();
      toast.success(
        updated?.published
          ? "Produto publicado na vitrine!"
          : "Produto removido da vitrine."
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  /**
   * Compartilha ou copia o link público de um produto
   */
  const shareProduct = (product: any) => {
    const baseUrl = import.meta.env.VITE_STOREFRONT_URL || "https://shoop.permupay.com.br";
    const url = `${baseUrl}/vitrine/${product.id}`;
    if (navigator.share) {
      navigator
        .share({ title: product.name, url })
        .catch(() => {
          navigator.clipboard.writeText(url);
          toast.success("Link copiado!");
        });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const pendingIds = new Set((pendingProducts as any[]).map((p) => p.id));

  const isPendingToPublish = (p: any) => {
    const hasStock = Number(p.stockQuantity ?? 0) > 0;
    const hasRealCost = Number(p.finalUnitCostBrl ?? p.averageCostBrl ?? 0) > 0;
    return p.active !== false && p.published !== true && hasStock && hasRealCost;
  };

  const listForCurrentView =
    view === "paraPublicar"
      ? (pendingProducts as any[])
      : (products as any[]);

  const filteredProducts = listForCurrentView.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      String(p.id).includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term);
    const matchView =
      view === "todos" ||
      view === "paraPublicar" ||
      (view === "publicados" && p.published) ||
      (view === "rascunhos" && !p.published);
    return matchSearch && matchView;
  });

  const publishedCount = (products as any[]).filter((p) => p.published).length;
  const draftCount = (products as any[]).filter((p) => !p.published).length;
  const pendingCount = (pendingProducts as any[]).length;

  const exportToExcel = () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }
    const now = new Date().toISOString().split("T")[0];
    const baseUrl = import.meta.env.VITE_STOREFRONT_URL || "https://shoop.permupay.com.br";
    const catalogRows = (products as any[]).map((p) => ({
      "Nome do Produto": p.name,
      "Categoria": p.category,
      "Descrição Curta": p.shortDescription || "—",
      "NCM": p.ncm || "—",
      "Tag de Promoção": p.promoTag || "—",
      "Publicado na Vitrine": p.published ? "Sim" : "Não",
      "Status": p.active ? "Ativo" : "Inativo",
      "Data de Criação": new Date(p.createdAt).toLocaleDateString("pt-BR"),
      "Link do Produto": `${baseUrl}/vitrine/${p.id}`,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(catalogRows);
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, `permupay-produtos-${now}.xlsx`);
    toast.success(`Planilha exportada!`);
  };

  return (
    <div className="space-y-6">
      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar produto permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>"{deleteConfirm?.name}"</strong> será removido
              definitivamente do sistema, incluindo imagens e histórico de
              estoque. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteProduct.mutate({ id: deleteConfirm.id })}
            >
              Apagar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Painel de reordenação ── */}
      {reorderMode && (
        <div className="rounded-xl border-2 border-primary/40 bg-card shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-primary/5 rounded-t-xl">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">Ordenar Vitrine</span>
              <span className="text-xs text-muted-foreground">— Arraste os cards para definir a sequência de exibição</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={cancelReorder}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={saveReorder} disabled={reorder.isPending}>
                <Check className="w-3.5 h-3.5" /> {reorder.isPending ? "Salvando…" : "Salvar ordem"}
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-1.5 max-h-[70vh] overflow-y-auto">
            {orderedProducts.map((product: any, index: number) => (
              <div
                key={product.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-2.5 rounded-lg border bg-background cursor-grab active:cursor-grabbing select-none transition-all
                  ${product.published ? "border-green-200 dark:border-green-900/50" : "border-border/60"}
                  hover:border-primary/40 hover:shadow-sm`}
              >
                {/* Posição */}
                <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center shrink-0">
                  {index + 1}
                </span>

                {/* Handle */}
                <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />

                {/* Imagem */}
                {product.imageUrl ? (
                  <div className="w-10 h-10 rounded border shrink-0 overflow-hidden bg-white">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-0.5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded border shrink-0 bg-muted flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}

                {/* Nome e categoria */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {product.published ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                      <Globe className="w-3 h-3 mr-1" /> Publicado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="w-3 h-3 mr-1" /> Rascunho
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      {!reorderMode && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie produtos, preços e publicação na vitrine
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(products as any[]).length > 0 && (
                <Button
                  onClick={enterReorderMode}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowUpDown className="w-4 h-4" /> Ordenar Vitrine
                </Button>
              )}
              <Button onClick={exportToExcel} disabled={products.length === 0} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar
              </Button>
              <Link href="/produtos/novo">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Novo Produto
                </Button>
              </Link>
            </div>
          </div>

          {/* Abas de filtro */}
          {products.length > 0 && (
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              {(
                [
                  { key: "todos", label: `Todos (${products.length})` },
                  { key: "publicados", label: `Publicados (${publishedCount})` },
                  { key: "rascunhos", label: `Rascunhos (${draftCount})` },
                  { key: "paraPublicar", label: `Para Publicar (${pendingCount})` },
                ] as { key: ProductView; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    view === key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Barra de pesquisa */}
          {products.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Pesquisar por nome, categoria ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          )}

          {view === "paraPublicar" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Produtos para Publicar
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                    Aqui aparecem produtos com entrada/estoque e custo calculado, mas ainda não publicados na vitrine.
                    Clique em <strong>Configurar venda</strong> para completar descrição, imagens, preço e publicação.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lista */}
          {products.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum produto cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-6">Comece criando seu primeiro produto</p>
              <Link href="/produtos/novo"><Button>Criar Produto</Button></Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {view === "paraPublicar"
                  ? "Nenhum produto pendente de publicação encontrado."
                  : `Nenhum produto encontrado com "${searchTerm}"`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredProducts.map((product: any) => {
                // Links do produto específico
                const productPixKey  = product.pixKey  || product.pixLink;
                const productCard    = product.cardPaymentUrl;
                const productBoleto  = product.boletoUrl;
                // Links globais (fallback para produtos criados antes da herança automática)
                const globalPixKey   = globalPayment?.pixKey  || globalPayment?.pixLink;
                const globalCard     = globalPayment?.cardPaymentUrl;
                const globalBoleto   = globalPayment?.boletoUrl;
                // Considera configurado se tiver link no produto OU nas settings globais
                const hasPaymentMethod = !!(productPixKey || productCard || productBoleto || globalPixKey || globalCard || globalBoleto);
                const lowStock = (product.minimumStock ?? 0) > 0 && (product.stockQuantity ?? 0) <= (product.minimumStock ?? 0);
                const noImage = !product.imageUrl;
                const hasPix = (product.suggestedPricePix ?? 0) > 0;
                const hasCard = (product.suggestedPriceCard ?? 0) > 0;
                const hasBoleto = (product.suggestedPriceBoleto ?? 0) > 0;
                const hasAnyPrice = hasPix || hasCard || hasBoleto || (product.suggestedPrice ?? 0) > 0;
                const publishedWithoutPayment = product.published && !hasPaymentMethod;

                return (
                  <div
                    key={product.id}
                    className={`rounded-lg border transition-all ${
                      product.active
                        ? "border-border bg-card hover:border-primary/50"
                        : "border-border/50 bg-muted/30"
                    }`}
                  >
                    <div className="p-4 space-y-4">
                      {/* Cabeçalho */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {product.imageUrl ? (
                            <div className="w-14 h-14 rounded-lg border shrink-0 overflow-hidden bg-white">
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-1" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-white border flex items-center justify-center shrink-0">
                              <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border cursor-pointer select-all shrink-0"
                                title="ID do produto — use este número no campo ID ao criar lotes"
                                onClick={() => { navigator.clipboard.writeText(String(product.id)); }}
                              >
                                #{product.id}
                              </span>
                              <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                              {product.published ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                                  <Globe className="w-3 h-3 mr-1" /> Publicado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <EyeOff className="w-3 h-3 mr-1" /> Rascunho
                                </Badge>
                              )}
                              {pendingIds.has(product.id) && !product.published && (
                                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                                  Para publicar
                                </Badge>
                              )}
                              {!product.active && <Badge variant="secondary" className="text-xs opacity-60">Inativo</Badge>}
                              {product.promoTag && <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">🏷️ {product.promoTag}</Badge>}
                              {lowStock && <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">⚠️ Baixo estoque</Badge>}
                              {publishedWithoutPayment && (
                                <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                                  ⚠️ Sem pagamento configurado
                                </Badge>
                              )}
                              {!hasPaymentMethod && !product.published && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                  Sem pagamento configurado
                                </Badge>
                              )}
                              {noImage && <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs"><ImageOff className="w-3 h-3 mr-1" />Sem imagem</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {product.category}
                              {product.ncm && ` • NCM: ${product.ncm}`}
                              {product.shortDescription && <span className="ml-1 text-muted-foreground/70">— {product.shortDescription}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{product.published ? "Na vitrine" : "Rascunho"}</span>
                            <Switch
                              checked={product.published ?? false}
                              onCheckedChange={(checked) => togglePublished.mutate({ productId: product.id, published: checked })}
                              disabled={togglePublished.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Preços e estoque */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-xs text-muted-foreground">Custo</p>
                          <p className="text-sm font-semibold text-foreground">
                            {product.costCurrency === "USD" ? `$${(product.costPriceUsd || 0).toFixed(2)}` : formatCurrency(product.costPrice || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Unit.</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.finalUnitCostBrl || product.averageCostBrl || product.costPrice || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Total</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency((product.finalUnitCostBrl || product.averageCostBrl || product.costPrice || 0) * (product.stockQuantity || 0))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Preço PIX</p>
                          <p className={`text-sm font-semibold ${hasPix ? "text-green-600" : "text-muted-foreground"}`}>
                            {hasPix ? formatCurrency(product.suggestedPricePix) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cartão / Boleto</p>
                          <p className="text-sm font-semibold text-foreground">
                            {hasCard ? formatCurrency(product.suggestedPriceCard) : hasBoleto ? formatCurrency(product.suggestedPriceBoleto) : !hasAnyPrice ? <span className="text-amber-600 text-xs">Não calculado</span> : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Estoque</p>
                          <p className={`text-sm font-semibold ${(product.stockQuantity ?? 0) === 0 ? "text-red-600" : lowStock ? "text-amber-600" : "text-foreground"}`}>
                            {(product.stockQuantity || 0).toFixed(0)} un.
                          </p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                        <Link href={`/produtos/${product.id}/editar`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Edit2 className="w-3.5 h-3.5" /> {view === "paraPublicar" ? "Configurar venda" : "Editar"}
                          </Button>
                        </Link>
                        <Link href={`/simulador?productId=${product.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" /> Simular
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => duplicate.mutate({ id: product.id })}>
                          <Copy className="w-3.5 h-3.5" /> Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => shareProduct(product)}
                        >
                          <Share2 className="w-3.5 h-3.5" /> Compartilhar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`gap-1.5 ${product.published ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                          onClick={() => togglePublished.mutate({ productId: product.id, published: !product.published })}
                          disabled={togglePublished.isPending}
                        >
                          {product.published ? <><EyeOff className="w-3.5 h-3.5" />Despublicar</> : <><Eye className="w-3.5 h-3.5" />Publicar</>}
                        </Button>
                        <div className="ml-auto flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              if (confirm("Desativar este produto?")) {
                                deactivate.mutate({ id: product.id });
                              }
                            }}
                          >
                            <Ban className="w-3.5 h-3.5" /> Desativar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive/50"
                            onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Apagar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
