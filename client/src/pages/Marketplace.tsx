/**
 * Marketplace.tsx — Vitrine pública de produtos
 *
 * Rota pública: /vitrine
 *
 * Renderiza cards de produto estilo marketplace com:
 * - Imagem do produto (com fallback)
 * - Preço final calculado
 * - Tags de promoção
 * - Badge de estoque
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Package, Tag } from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface MarketplaceProduct {
  id: number;
  name: string;
  category: string;
  imageUrl: string | null;
  promoTag: string | null;
  finalUnitCostBrl: number;
  stockQuantity: number;
}

// ─── Formatadores ──────────────────────────────────────────────────────────────

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const CATEGORY_LABELS: Record<string, string> = {
  CELULAR: "Celular",
  ELETRONICO: "Eletrônico",
  PERFUME: "Perfume",
  OUTRO: "Outro",
};

// ─── ProductCard ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: MarketplaceProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const inStock = product.stockQuantity > 0;

  return (
    <div className="group relative flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Package className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Tag de promoção */}
        {product.promoTag && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-xs font-bold gap-1 px-2 py-0.5 rounded-full shadow">
              <Tag className="w-3 h-3" />
              {product.promoTag}
            </Badge>
          </div>
        )}

        {/* Badge de estoque */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">
              Sem estoque
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Categoria */}
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {CATEGORY_LABELS[product.category] ?? product.category}
        </span>

        {/* Nome */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">
          {product.name}
        </h3>

        {/* Preço */}
        <div className="mt-auto pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">A partir de</p>
          <p className="text-xl font-bold text-primary font-mono">
            {formatBRL(product.finalUnitCostBrl)}
          </p>
        </div>

        {/* Estoque mínimo (badge de disponibilidade) */}
        {inStock && product.stockQuantity <= 5 && (
          <p className="text-xs text-orange-600 font-medium">
            ⚡ Últimas {product.stockQuantity} unidades
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton do Card ─────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-24 mt-2" />
      </div>
    </div>
  );
}

// ─── Página Marketplace ───────────────────────────────────────────────────────

export default function Marketplace() {
  const { data: products, isLoading, error } = trpc.marketplace.products.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Vitrine</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Produtos disponíveis para venda
          </p>
        </div>
      </div>

      {/* Grid de produtos */}
      <div className="container mx-auto max-w-6xl px-4 py-10">
        {/* Erro */}
        {error && (
          <div className="text-center py-16 text-muted-foreground">
            Não foi possível carregar os produtos.
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Sem produtos */}
        {!isLoading && !error && products?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">
              Nenhum produto disponível no momento.
            </p>
          </div>
        )}

        {/* Grid de cards */}
        {!isLoading && products && products.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              {products.length} produto{products.length !== 1 ? "s" : ""} disponível
              {products.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product as MarketplaceProduct}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
