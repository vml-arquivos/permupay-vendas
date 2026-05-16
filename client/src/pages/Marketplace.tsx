/**
 * Marketplace.tsx — Vitrine e-commerce pública
 *
 * Catálogo de produtos com filtro por categoria, busca por nome,
 * cards com botões de pagamento (PIX, Cartão, Boleto).
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ShoppingBag,
  Package,
  CreditCard,
  FileText,
  LogIn,
  Search,
  Heart,
} from "lucide-react";
import { useState, useMemo } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: number;
  name: string;
  category: string;
  categoryLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  promoTag: string | null;
  suggestedPrice: number;
  suggestedPricePix: number;
  suggestedPriceCard: number;
  suggestedPriceBoleto: number;
  finalUnitCostBrl: number;
  stockQuantity: number;
  minimumStock: number;
  paymentPlatform: string | null;
  pixKey: string | null;
  pixLink: string | null;
  cardPaymentUrl: string | null;
  boletoUrl: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes",
  OUTRO: "Outros",
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function displayPrice(product: CatalogProduct): number {
  if (product.suggestedPricePix > 0) return product.suggestedPricePix;
  if (product.suggestedPrice > 0) return product.suggestedPrice;
  return product.finalUnitCostBrl;
}

// ─── Lógica de status de estoque ─────────────────────────────────────────────

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(product: CatalogProduct): StockStatus {
  const qty = product.stockQuantity ?? 0;
  const min = product.minimumStock ?? 0;
  if (qty <= 0) return "out_of_stock";
  // Considera "últimas unidades" se estoque <= estoque mínimo (e mínimo > 0)
  if (min > 0 && qty <= min) return "low_stock";
  return "in_stock";
}

// ─── Componente ProductCard ───────────────────────────────────────────────────

function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus = getStockStatus(product);
  const inStock = stockStatus !== "out_of_stock";
  const isLowStock = stockStatus === "low_stock";

  return (
    <div className="group flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Imagem 1:1 */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              !inStock ? "opacity-60 grayscale" : ""
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <Package className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Badge de promoção (só aparece se em estoque) */}
        {product.promoTag && inStock && (
          <Badge className="absolute top-3 left-3 bg-orange-500 text-white shadow-lg">
            🏷️ {product.promoTag}
          </Badge>
        )}

        {/* Badge de últimas unidades */}
        {isLowStock && (
          <Badge className="absolute top-3 right-3 bg-amber-500 text-white shadow-lg text-xs">
            ⚡ Últimas unidades
          </Badge>
        )}

        {/* Overlay sem estoque */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <span className="text-white font-bold text-sm bg-black/70 px-4 py-1.5 rounded-full">
              Sem Estoque
            </span>
            <a
              href="/desejos"
              className="text-xs text-white/90 underline hover:text-white transition-colors"
            >
              Avisar quando chegar
            </a>
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Categoria badge */}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {product.categoryLabel ||
            CATEGORY_LABELS[product.category] ||
            product.category}
        </span>

        {/* Nome */}
        <h3 className="font-semibold text-base leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Descrição curta */}
        {product.shortDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.shortDescription}
          </p>
        )}

        {/* Preços */}
        <div className="space-y-1 mt-auto">
          {/* Preço PIX — destaque */}
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${
              inStock
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground line-through"
            }`}>
              {formatBRL(displayPrice(product))}
            </span>
            {(product.pixLink || product.pixKey) && inStock && (
              <span className="text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                no PIX
              </span>
            )}
          </div>

          {/* Preço cartão se diferente */}
          {product.suggestedPriceCard > 0 && product.cardPaymentUrl && inStock && (
            <p className="text-xs text-muted-foreground">
              ou {formatBRL(product.suggestedPriceCard)} no cartão
            </p>
          )}
        </div>

        {/* Botões de pagamento */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          {/* Produto sem estoque — CTA para lista de desejos */}
          {!inStock && (
            <a
              href="/desejos"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground text-sm font-medium hover:border-primary hover:text-primary transition-colors"
            >
              <Heart className="w-4 h-4" />
              Avisar quando chegar
            </a>
          )}

          {/* PIX */}
          {(product.pixLink || product.pixKey) && inStock && (
            <a
              href={product.pixLink || `https://nubank.com.br/cobrar/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M11.944 17.97L4.58 10.607 7.408 7.78l4.536 4.536 4.536-4.536 2.828 2.828-7.364 7.364zm.056-15.97C6.477 2 2 6.477 2 12c0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10z" />
              </svg>
              Pagar com PIX
            </a>
          )}

          {/* Cartão */}
          {product.cardPaymentUrl && inStock && (
            <a
              href={product.cardPaymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Pagar com Cartão
            </a>
          )}

          {/* Boleto */}
          {product.boletoUrl && inStock && (
            <a
              href={product.boletoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              Gerar Boleto
            </a>
          )}

          {/* Sem método de pagamento configurado (mas em estoque) */}
          {inStock &&
            !product.pixLink &&
            !product.pixKey &&
            !product.cardPaymentUrl &&
            !product.boletoUrl && (
              <p className="text-xs text-center text-muted-foreground py-1">
                Entre em contato para comprar
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton do Card ─────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-8 w-full mt-4" />
      </div>
    </div>
  );
}

// ─── Página Marketplace ───────────────────────────────────────────────────────

export default function Marketplace() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: allProducts,
    isLoading,
    error,
  } = trpc.marketplace.products.useQuery();

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    return (allProducts as CatalogProduct[]).filter((p) => {
      const matchCategory =
        !categoryFilter || p.category === categoryFilter;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [allProducts, categoryFilter, searchQuery]);

  // Extrair categorias únicas dos produtos
  const availableCategories = useMemo(() => {
    if (!allProducts) return [];
    const cats = [
      ...new Set((allProducts as CatalogProduct[]).map((p) => p.category)),
    ];
    return cats;
  }, [allProducts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">PermuPay</h1>
              <p className="text-xs text-muted-foreground">
                Catálogo de Produtos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/desejos"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Heart className="w-4 h-4" />
              Lista de Desejos
            </a>
            <a
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </a>
          </div>
        </div>
      </header>

      {/* Barra de filtros */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Busca */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filtros de categoria */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                categoryFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Todos
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setCategoryFilter(cat === categoryFilter ? null : cat)
                }
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 pb-16">
        {/* Erro */}
        {error && (
          <div className="text-center py-16 text-muted-foreground">
            Não foi possível carregar os produtos. Tente novamente mais tarde.
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Contador de resultados */}
        {!isLoading && !error && filteredProducts.length > 0 && (
          <p className="text-sm text-muted-foreground mb-5">
            {filteredProducts.length} produto
            {filteredProducts.length !== 1 ? "s" : ""} encontrado
            {filteredProducts.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Grid de cards */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}

            {/* Estado vazio */}
            {filteredProducts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {categoryFilter
                    ? "Nenhum produto nesta categoria"
                    : "Nenhum produto disponível no momento"}
                </h3>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Volte em breve!
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="border-t py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Catálogo gerado por{" "}
          <span className="font-semibold text-foreground">PermuPay Vendas</span>
        </p>
      </footer>
    </div>
  );
}
