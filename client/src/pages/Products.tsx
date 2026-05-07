import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Plus,
  Edit2,
  Copy,
  Trash2,
  Eye,
  Search,
  AlertCircle,
} from "lucide-react";

export default function Products() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");

  const deactivate = trpc.products.deactivate.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  });

  const duplicate = trpc.products.duplicate.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  });

  const filteredProducts = products.filter(
    (p: any) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    if (products.length === 0) {
      alert("Nenhum produto para exportar");
      return;
    }

    const rows: any[] = [];

    // Cabeçalho
    rows.push([
      "Nome do Produto",
      "Categoria",
      "NCM",
      "Preço de Custo",
      "Custo de Embalagem",
      "Custo de Frete",
      "Custo Operacional",
      "Custo Total",
      "Margem Desejada (%)",
      "Regime Tributário",
      "Alíquota Estimada (%)",
      "Status",
      "Data de Criação",
    ]);

    // Dados
    products.forEach((p: any) => {
      const totalCost =
        (p.costPrice || 0) +
        (p.packagingCost || 0) +
        (p.inboundShippingCost || 0) +
        (p.operationalCost || 0);
      const createdAt = new Date(p.createdAt).toLocaleDateString("pt-BR");

      rows.push([
        p.name,
        p.category,
        p.ncm || "—",
        formatCurrency(p.costPrice || 0),
        formatCurrency(p.packagingCost || 0),
        formatCurrency(p.inboundShippingCost || 0),
        formatCurrency(p.operationalCost || 0),
        formatCurrency(totalCost),
        formatPercent(p.desiredMarginRate || 0),
        p.taxRegime || "—",
        formatPercent(p.estimatedTaxRate || 0),
        p.active ? "Ativo" : "Inativo",
        createdAt,
      ]);
    });

    // Criar CSV
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

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `produtos-${new Date().toISOString().split("T")[0]}.csv`);
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
                Gerencie seus produtos e calcule preços
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
                const totalCost =
                  (product.costPrice || 0) +
                  (product.packagingCost || 0) +
                  (product.inboundShippingCost || 0) +
                  (product.operationalCost || 0);

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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {product.name}
                            </h3>
                            {!product.active && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                Inativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {product.category}
                            {product.ncm && ` • NCM: ${product.ncm}`}
                          </p>
                        </div>
                      </div>

                      {/* Informações de custos */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-xs text-muted-foreground">Preço de Custo</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.costPrice || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Embalagem</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.packagingCost || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Frete</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.inboundShippingCost || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Operacional</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(product.operationalCost || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Resumo de cálculo */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Total</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(totalCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Margem Desejada</p>
                          <p className="text-sm font-semibold text-primary">
                            {formatPercent(product.desiredMarginRate || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Regime Tributário</p>
                          <p className="text-sm font-semibold text-foreground">
                            {product.taxRegime || "—"}
                          </p>
                        </div>
                      </div>

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
                            if (confirm("Tem certeza que deseja desativar este produto?")) {
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
