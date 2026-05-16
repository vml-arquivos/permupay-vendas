/**
 * Products.tsx — Gerenciamento de Produtos com Painel de Catálogo
 *
 * Inclui:
 * - Listagem de produtos com busca e filtro
 * - Toggle de publicação na vitrine por produto
 * - Badges de status (publicado, estoque baixo, sem pagamento)
 * - Exportação CSV
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { toast } from "sonner";

type ProductView = "todos" | "publicados" | "rascunhos";

export default function Products() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<ProductView>("todos");

  const deactivate = trpc.products.deactivate.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto desativado.");
    },
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

  // Filtros
  const filteredProducts = (products as any[]).filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchView =
      view === "todos" ||
      (view === "publicados" && p.published) ||
      (view === "rascunhos" && !p.published);
    return matchSearch && matchView;
  });

  const publishedCount = (products as any[]).filter((p) => p.published).length;
  const draftCount = (products as any[]).filter((p) => !p.published).length;

  const exportToExcel = () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    const rows: any[] = [];
    rows.push([
      "Nome do Produto",
      "Categoria",
      "Descrição Curta",
      "NCM",
      "Moeda de Custo",
      "Preço de Custo",
      "Custo em Real",
      "Custo de Embalagem",
      "Custo de Frete",
      "Custo Operacional",
      "Custo Final Unitário",
      "Preço Sugerido PIX",
      "Preço Sugerido Cartão",
      "Preço Sugerido Boleto",
      "Estoque Atual",
      "Estoque Mínimo",
      "Margem Desejada (%)",
      "Regime Tributário",
      "Alíquota Estimada (%)",
      "Publicado",
      "Tag de Promoção",
      "Plataforma de Pagamento",
      "Status",
      "Data de Criação",
    ]);

    (products as any[]).forEach((p) => {
      const createdAt = new Date(p.createdAt).toLocaleDateString("pt-BR");
      rows.push([
        p.name,
        p.category,
        p.shortDescription || "—",
        p.ncm || "—",
        p.costCurrency || "BRL",
        formatCurrency(p.costPrice || 0),
        formatCurrency(p.costPriceBrl || 0),
        formatCurrency(p.packagingCost || 0),
        formatCurrency(p.inboundShippingCost || 0),
        formatCurrency(p.operationalCost || 0),
        formatCurrency(p.finalUnitCostBrl || 0),
        formatCurrency(p.suggestedPricePix || 0),
        formatCurrency(p.suggestedPriceCard || 0),
        formatCurrency(p.suggestedPriceBoleto || 0),
        (p.stockQuantity || 0).toFixed(2),
        (p.minimumStock || 0).toFixed(2),
        formatPercent(p.desiredMarginRate || 0),
        p.taxRegime || "—",
        formatPercent(p.estimatedTaxRate || 0),
        p.published ? "Sim" : "Não",
        p.promoTag || "—",
        p.paymentPlatform || "—",
        p.active ? "Ativo" : "Inativo",
        createdAt,
      ]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell: any) => {
            const str = String(cell);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `produtos-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie produtos, preços e publicação na vitrine
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={exportToExcel}
                disabled={products.length === 0}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              <Link href="/produtos/novo">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Produto
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
                placeholder="Pesquisar por nome ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          )}

          {/* Lista de produtos */}
          {products.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum produto cadastrado
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece criando seu primeiro produto
              </p>
              <Link href="/produtos/novo">
                <Button>Criar Produto</Button>
              </Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum produto encontrado com "{searchTerm}"
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredProducts.map((product: any) => {
                const hasPaymentMethod =
                  product.pixLink ||
                  product.pixKey ||
                  product.cardPaymentUrl ||
                  product.boletoUrl;
                const lowStock =
                  product.minimumStock > 0 &&
                  product.stockQuantity <= product.minimumStock;

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
                      {/* Cabeçalho do card */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Thumbnail */}
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover border shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                              <ShoppingBag className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground truncate">
                                {product.name}
                              </h3>
                              {product.published && (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                                  <Globe className="w-3 h-3 mr-1" />
                                  Publicado
                                </Badge>
                              )}
                              {!product.active && (
                                <Badge variant="secondary" className="text-xs">
                                  Inativo
                                </Badge>
                              )}
                              {product.promoTag && (
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                                  🏷️ {product.promoTag}
                                </Badge>
                              )}
                              {lowStock && (
                                <Badge
                                  variant="outline"
                                  className="text-amber-600 border-amber-300 text-xs"
                                >
                                  ⚠️ Estoque baixo
                                </Badge>
                              )}
                              {!hasPaymentMethod && product.published && (
                                <Badge
                                  variant="outline"
                                  className="text-red-600 border-red-300 text-xs"
                                >
                                  Sem pagamento configurado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {product.category}
                              {product.ncm && ` • NCM: ${product.ncm}`}
                              {product.shortDescription && (
                                <span className="ml-1 text-muted-foreground/70">
                                  — {product.shortDescription}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Toggle de publicação */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {product.published ? "Na vitrine" : "Rascunho"}
                            </span>
                            <Switch
                              checked={product.published ?? false}
                              onCheckedChange={(checked) =>
                                togglePublished.mutate({
                                  productId: product.id,
                                  published: checked,
                                })
                              }
                              disabled={togglePublished.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Informações de custos */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-xs text-muted-foreground">Preço de Custo</p>
                          <p className="text-sm font-semibold text-foreground">
                            {product.costCurrency === "USD"
                              ? `$${(product.costPriceUsd || 0).toFixed(2)}`
                              : formatCurrency(product.costPrice || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Final</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.finalUnitCostBrl || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Preço PIX</p>
                          <p className="text-sm font-semibold text-green-600">
                            {product.suggestedPricePix > 0
                              ? formatCurrency(product.suggestedPricePix)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Estoque</p>
                          <p
                            className={`text-sm font-semibold ${
                              lowStock ? "text-amber-600" : "text-foreground"
                            }`}
                          >
                            {(product.stockQuantity || 0).toFixed(0)} un.
                          </p>
                        </div>
                      </div>

                      {/* Métodos de pagamento configurados */}
                      {(product.pixKey ||
                        product.pixLink ||
                        product.cardPaymentUrl ||
                        product.boletoUrl) && (
                        <div className="flex flex-wrap gap-2">
                          {(product.pixKey || product.pixLink) && (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full">
                              <svg
                                viewBox="0 0 24 24"
                                className="w-3 h-3 fill-current"
                              >
                                <path d="M11.944 17.97L4.58 10.607 7.408 7.78l4.536 4.536 4.536-4.536 2.828 2.828-7.364 7.364zm.056-15.97C6.477 2 2 6.477 2 12c0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10z" />
                              </svg>
                              PIX
                            </span>
                          )}
                          {product.cardPaymentUrl && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
                              <CreditCard className="w-3 h-3" />
                              Cartão
                            </span>
                          )}
                          {product.boletoUrl && (
                            <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-700 border border-gray-200 px-2 py-1 rounded-full">
                              Boleto
                            </span>
                          )}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link href={`/simulador?productId=${product.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            Simular
                          </Button>
                        </Link>
                        <Link href={`/produtos/${product.id}/editar`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Edit2 className="w-3.5 h-3.5" />
                            Editar
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => duplicate.mutate({ id: product.id })}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-danger hover:text-danger ml-auto"
                          onClick={() => {
                            if (
                              confirm(
                                "Tem certeza que deseja desativar este produto?"
                              )
                            ) {
                              deactivate.mutate({ id: product.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Desativar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
