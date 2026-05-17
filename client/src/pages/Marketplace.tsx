/**
 * Marketplace.tsx — Vitrine Pública PermuPay
 *
 * REGRAS NÃO NEGOCIÁVEIS:
 * - Fundo bege/creme (#f5f0e8)
 * - Cards SEM borda, fundo branco, sombra suave
 * - Foto NÃO cortada: object-contain dentro de área quadrada com padding
 * - Grid: 1 coluna mobile, 2 tablet, 3 desktop
 * - Cards GRANDES (foto alta, nome, descrição, preço)
 * - SEM botão "CTA Pagar com PIX" no card — apenas link para /vitrine/:id
 * - Clicar no card leva para /vitrine/:id
 * - Preços exibidos de forma discreta abaixo do nome
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, ChevronRight } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────
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
  stockQuantity: number;
  minimumStock: number;
  paymentPlatform: string | null;
  pixKey: string | null;
  pixLink: string | null;
  cardPaymentUrl: string | null;
  boletoUrl: string | null;
  cardInstallments?: number | null;
  boletoMonths?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  CELULAR:    { label: "Celulares",   icon: "📱" },
  ELETRONICO: { label: "Eletrônicos", icon: "⚡" },
  PERFUME:    { label: "Perfumes",    icon: "✨" },
  OUTRO:      { label: "Outros",      icon: "🛍️" },
};

function getDisplayPrice(p: CatalogProduct): { value: number; label: string } | null {
  if ((p.suggestedPricePix    ?? 0) > 0) return { value: p.suggestedPricePix,    label: "PIX" };
  if ((p.suggestedPriceCard   ?? 0) > 0) return { value: p.suggestedPriceCard,   label: "Cartão" };
  if ((p.suggestedPriceBoleto ?? 0) > 0) return { value: p.suggestedPriceBoleto, label: "Boleto" };
  if ((p.suggestedPrice       ?? 0) > 0) return { value: p.suggestedPrice,       label: "" };
  return null;
}

function getStockStatus(p: CatalogProduct) {
  const qty = p.stockQuantity ?? 0;
  const min = p.minimumStock  ?? 0;
  if (qty <= 0)             return "out_of_stock" as const;
  if (min > 0 && qty <= min) return "low_stock"   as const;
  return "in_stock" as const;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-square bg-stone-100" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-stone-100 rounded w-20" />
        <div className="h-5 bg-stone-100 rounded w-4/5" />
        <div className="h-3 bg-stone-100 rounded w-3/5" />
        <div className="h-7 bg-stone-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

// ── Card de Produto ───────────────────────────────────────────────────────────
function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus   = getStockStatus(product);
  const inStock       = stockStatus !== "out_of_stock";
  const price         = getDisplayPrice(product);
  const cardInstallments = Math.max(1, Math.round(product.cardInstallments ?? 3));
  const cardPrice     = (product.suggestedPriceCard ?? 0) > 0 ? product.suggestedPriceCard : null;
  const catMeta       = CATEGORY_META[product.category];

  return (
    <Link href={`/vitrine/${product.id}`}>
      <div
        className={`bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group ${!inStock ? "opacity-70" : ""}`}
      >
        {/* ── Imagem — NÃO cortada ── */}
        <div className="relative bg-stone-50" style={{ aspectRatio: "1 / 1" }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl opacity-15 select-none">✨</span>
            </div>
          )}

          {/* Badges */}
          {product.promoTag && inStock && (
            <span className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm">
              {product.promoTag}
            </span>
          )}
          {stockStatus === "low_stock" && (
            <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              Últimas unidades
            </span>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="bg-stone-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                Indisponível
              </span>
            </div>
          )}
        </div>

        {/* ── Conteúdo ── */}
        <div className="p-5">
          {/* Categoria */}
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
            {catMeta?.icon && <span className="mr-1">{catMeta.icon}</span>}
            {catMeta?.label ?? product.category}
          </p>

          {/* Nome */}
          <h3 className="font-semibold text-stone-900 text-base leading-snug line-clamp-2 group-hover:text-stone-600 transition-colors">
            {product.name}
          </h3>

          {/* Descrição curta */}
          {product.shortDescription && (
            <p className="text-xs text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
              {product.shortDescription}
            </p>
          )}

          {/* Preço + seta */}
          {inStock && price ? (
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-stone-900 leading-none">
                  {formatBRL(price.value)}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {price.label === "PIX" && (
                    <span className="text-emerald-600 font-semibold">no PIX</span>
                  )}
                  {price.label === "Cartão" && cardPrice && cardInstallments > 1 && (
                    <span>ou {cardInstallments}x de {formatBRL(cardPrice / cardInstallments)}</span>
                  )}
                  {price.label === "Boleto" && (
                    <span>no boleto</span>
                  )}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-stone-900 group-hover:bg-stone-700 flex items-center justify-center transition-colors shrink-0">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : inStock ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-stone-400 italic">Consulte o preço</p>
              <div className="w-9 h-9 rounded-full bg-stone-900 group-hover:bg-stone-700 flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Link href="/desejos">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors"
                >
                  <Heart className="w-3 h-3" />
                  Avisar quando chegar
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function Marketplace() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const productsQuery = trpc.marketplace.products.useQuery();
  const products      = (productsQuery.data ?? []) as CatalogProduct[];
  const isLoading     = productsQuery.isLoading;

  const availableCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products]
  );

  const filtered = useMemo(
    () => activeCategory ? products.filter((p) => p.category === activeCategory) : products,
    [products, activeCategory]
  );

  const PANEL_URL = import.meta.env.VITE_PANEL_URL ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5f0e8" }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex-1" />
          <Link href="/vitrine">
            <span className="text-xl font-black tracking-widest text-stone-900 cursor-pointer select-none">
              PERMUPAY
            </span>
          </Link>
          <div className="flex-1 flex justify-end">
            <a
              href={`${PANEL_URL}/login`}
              className="px-5 py-2 rounded-lg border border-stone-900 text-stone-900 text-sm font-medium hover:bg-stone-900 hover:text-white transition-colors"
            >
              Entrar
            </a>
          </div>
        </div>

        {/* Nav secundária */}
        <div className="border-t border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-center gap-10 h-11">
              <button
                onClick={() => setActiveCategory(null)}
                className={`text-sm font-medium pb-0.5 transition-colors ${activeCategory === null ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-500 hover:text-stone-900"}`}
              >
                Catálogo
              </button>
              <Link href="/desejos">
                <span className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors cursor-pointer">
                  Lista de Desejos
                </span>
              </Link>
              <a
                href={`${PANEL_URL}/login`}
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
              >
                Gerenciar
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "360px" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-stone-900/65" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center py-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4">
            A SUA VITRINE PREMIUM DE<br />
            <span className="text-stone-300">PRODUTOS EXCLUSIVOS.</span>
          </h1>
          <p className="text-stone-300 text-base sm:text-lg max-w-2xl mb-8">
            Crie catálogos prontos, gerencie estoque e finalize vendas com a simplicidade
            e a sofisticação que seu negócio merece. Permupay transforma sua vitrine.
          </p>
          <button
            onClick={() =>
              document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-8 py-3 rounded-lg border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-stone-900 transition-colors"
          >
            Explorar Catálogo
          </button>
        </div>
      </section>

      {/* ── FILTROS DE CATEGORIA ─────────────────────────────────────────── */}
      {availableCategories.length > 1 && (
        <div className="border-b border-stone-200 bg-white/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === null ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
            >
              Todos
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {CATEGORY_META[cat]?.icon} {CATEGORY_META[cat]?.label ?? cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VITRINE DE PRODUTOS ──────────────────────────────────────────── */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-bold text-stone-900">Vitrine de Destaques</h2>
          {!isLoading && filtered.length > 0 && (
            <p className="text-sm text-stone-400">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-stone-100 flex items-center justify-center">
              <span className="text-4xl">✨</span>
            </div>
            <h3 className="text-xl font-semibold text-stone-700 mb-2">Vitrine em breve</h3>
            <p className="text-stone-400 mb-8">Estamos preparando os produtos. Volte em breve!</p>
            <Link href="/desejos">
              <button className="px-6 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors inline-flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Cadastrar na Lista de Desejos
              </button>
            </Link>
          </div>
        ) : (
          /* Grid: 1 col mobile, 2 col tablet, 3 col desktop */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>

      {/* ── SEÇÃO LISTA DE DESEJOS ───────────────────────────────────────── */}
      <section className="py-20 mt-8" style={{ backgroundColor: "#ede8e0" }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-stone-900 mb-3">
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-stone-500 mb-8 text-sm">
            Não encontrou o que procura? Registre sua demanda e entraremos em contato.
          </p>
          <Link href="/desejos">
            <button className="px-8 py-3.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 transition-colors inline-flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ── RODAPÉ ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav className="flex items-center gap-6 text-sm text-stone-500">
              <button
                onClick={() => setActiveCategory(null)}
                className="hover:text-stone-900 transition-colors"
              >
                Catálogo
              </button>
              <Link href="/desejos">
                <span className="hover:text-stone-900 transition-colors cursor-pointer">
                  Lista de Desejos
                </span>
              </Link>
              <a
                href={`${PANEL_URL}/login`}
                className="hover:text-stone-900 transition-colors"
              >
                Entrar
              </a>
            </nav>
            <p className="text-xs text-stone-400">
              © {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
