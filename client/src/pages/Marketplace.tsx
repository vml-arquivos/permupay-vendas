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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo Shop Permapay */}
          <Link href="/vitrine">
            <div className="flex items-center gap-2.5 cursor-pointer select-none group">
              {/* Ícone SVG inline */}
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <rect width="34" height="34" rx="9" fill="#1c1917"/>
                <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5V12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5V12.5Z" fill="#f5f0e8"/>
                <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5V21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5V21.5Z" fill="#a8a29e"/>
              </svg>
              <div className="leading-none">
                <span className="block text-[10px] font-semibold text-stone-400 tracking-[0.18em] uppercase">Shop</span>
                <span className="block text-lg font-black tracking-widest text-stone-900 group-hover:text-stone-700 transition-colors">PERMAPAY</span>
              </div>
            </div>
          </Link>

          {/* Nav central */}
          <nav className="hidden sm:flex items-center gap-8">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-sm font-medium pb-0.5 transition-colors border-b-2 ${activeCategory === null ? "text-stone-900 border-stone-900" : "text-stone-500 border-transparent hover:text-stone-900"}`}
            >
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors cursor-pointer border-b-2 border-transparent pb-0.5">
                Lista de Desejos
              </span>
            </Link>
            <a
              href={`${PANEL_URL}/login`}
              className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors border-b-2 border-transparent pb-0.5"
            >
              Gerenciar
            </a>
          </nav>

          {/* CTA Entrar */}
          <a
            href={`${PANEL_URL}/login`}
            className="shrink-0 px-4 py-2 rounded-lg border border-stone-900 text-stone-900 text-sm font-medium hover:bg-stone-900 hover:text-white transition-colors"
          >
            Entrar
          </a>
        </div>

        {/* Nav mobile */}
        <div className="sm:hidden border-t border-stone-100 bg-white">
          <nav className="flex items-center justify-center gap-8 h-10">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-xs font-medium pb-0.5 transition-colors ${activeCategory === null ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-500"}`}
            >
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-xs font-medium text-stone-500 hover:text-stone-900 cursor-pointer">Lista de Desejos</span>
            </Link>
            <a href={`${PANEL_URL}/login`} className="text-xs font-medium text-stone-500 hover:text-stone-900">Gerenciar</a>
          </nav>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "420px" }}>
        {/* Imagem de fundo */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1600&q=80')",
          }}
        />
        {/* Gradiente duplo: escuro embaixo, levemente dourado */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(28,25,23,0.80) 0%, rgba(28,25,23,0.60) 50%, rgba(87,70,50,0.70) 100%)" }} />

        {/* Conteúdo hero */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center py-24">
          {/* Badge superior */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold tracking-widest uppercase mb-5 backdrop-blur-sm">
            ✦ Vitrine Premium
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4">
            A Sua Vitrine<br />
            <span className="text-amber-300">dos Desejos.</span>
          </h1>
          <p className="text-stone-300 text-base sm:text-lg max-w-2xl mb-8 leading-relaxed">
            Produtos selecionados com cuidado. Preços transparentes.
            Experiência de compra simples e sofisticada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() =>
                document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
              }
              className="px-8 py-3.5 rounded-xl bg-white text-stone-900 text-sm font-bold hover:bg-stone-100 transition-colors shadow-lg"
            >
              Explorar Catálogo
            </button>
            <Link href="/desejos">
              <button className="px-8 py-3.5 rounded-xl border-2 border-white/40 text-white text-sm font-semibold hover:border-white hover:bg-white/10 transition-colors backdrop-blur-sm">
                Lista de Desejos
              </button>
            </Link>
          </div>
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", height: "40px", width: "100%" }}>
            <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill="#f5f0e8"/>
          </svg>
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
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Coleção em destaque</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 leading-tight">
              Vitrine dos <span className="italic font-black" style={{ color: "#b45309" }}>Desejos</span>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p className="text-sm text-stone-400 shrink-0">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo no rodapé */}
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="34" height="34" rx="9" fill="#1c1917"/>
                <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5V12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5V12.5Z" fill="#f5f0e8"/>
                <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5V21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5V21.5Z" fill="#a8a29e"/>
              </svg>
              <span className="font-black tracking-widest text-stone-700 text-sm">PERMAPAY</span>
            </div>
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
