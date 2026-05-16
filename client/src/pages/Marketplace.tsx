/**
 * Marketplace.tsx — Vitrine Pública PermuPay
 * Design: clean/premium — fundo creme, logo centralizado, hero com perfumes
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Heart,
  Zap,
  CreditCard,
  FileText,
  MessageCircle,
} from "lucide-react";

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

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
function getStockStatus(p: CatalogProduct): StockStatus {
  const qty = p.stockQuantity ?? 0;
  const min = p.minimumStock ?? 0;
  if (qty <= 0) return "out_of_stock";
  if (min > 0 && qty <= min) return "low_stock";
  return "in_stock";
}
// Retorna o preço de exibição principal (apenas dados comerciais finais, nunca custo interno)
function displayPrice(p: CatalogProduct): number | null {
  if ((p.suggestedPricePix ?? 0) > 0) return p.suggestedPricePix;
  if ((p.suggestedPrice ?? 0) > 0) return p.suggestedPrice;
  return null;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 animate-pulse">
      <div className="aspect-square bg-stone-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-stone-200 rounded w-20" />
        <div className="h-5 bg-stone-200 rounded w-full" />
        <div className="h-3 bg-stone-200 rounded w-3/4" />
        <div className="h-10 bg-stone-200 rounded-xl mt-4" />
      </div>
    </div>
  );
}

// ── Card de Produto ───────────────────────────────────────────────────────────
function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus = getStockStatus(product);
  const inStock = stockStatus !== "out_of_stock";
  const isLowStock = stockStatus === "low_stock";

  return (
    <div className={`group bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex flex-col ${inStock ? "border-stone-200 hover:border-stone-300" : "border-stone-200 opacity-75"}`}>
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-stone-50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-30">
              {CATEGORY_META[product.category]?.icon ?? "🛍️"}
            </span>
          </div>
        )}
        {/* Badges */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-stone-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Sem Estoque
            </span>
          </div>
        )}
        {inStock && isLowStock && (
          <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Últimas unidades
          </span>
        )}
        {product.promoTag && inStock && !isLowStock && (
          <span className="absolute top-2 left-2 bg-stone-800 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {product.promoTag}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-1">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1">
          {CATEGORY_META[product.category]?.label ?? product.category}
        </span>
        <h3 className="font-semibold text-stone-900 text-sm leading-snug mb-1.5 line-clamp-2">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-3 flex-1">
            {product.shortDescription}
          </p>
        )}

        {/* Preços e botões */}
        <div className="mt-auto">
          {inStock ? (
            <>
              {displayPrice(product) !== null ? (
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-xl font-bold text-stone-900">{formatBRL(displayPrice(product)!)}</span>
                  {(product.pixLink || product.pixKey) && (
                    <span className="text-xs text-emerald-600 font-medium">no PIX</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic mb-1">Consulte o preço</p>
              )}
              {product.suggestedPriceCard > 0 && product.cardPaymentUrl && (
                <p className="text-xs text-stone-400 mb-3">
                  ou {formatBRL(product.suggestedPriceCard)} no cartão
                </p>
              )}
              {product.suggestedPriceBoleto > 0 && product.boletoUrl && !product.cardPaymentUrl && (
                <p className="text-xs text-stone-400 mb-3">
                  Boleto: {formatBRL(product.suggestedPriceBoleto)}
                </p>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
                {(product.pixLink || product.pixKey) && (
                  <a
                    href={product.pixLink ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Pagar com PIX
                  </a>
                )}
                {product.cardPaymentUrl && (
                  <a
                    href={product.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl border border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-stone-800 text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Pagar com Cartão
                  </a>
                )}
                {product.boletoUrl && (
                  <a
                    href={product.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-4 rounded-xl border border-stone-200 hover:border-stone-400 text-stone-600 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Gerar Boleto
                  </a>
                )}
                {!product.pixLink && !product.pixKey && !product.cardPaymentUrl && !product.boletoUrl && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-sm text-stone-400 font-medium mb-2">Produto indisponível</p>
              <Link href="/desejos">
                <button className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:text-stone-700 text-stone-400 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Heart className="w-3.5 h-3.5" />
                  Avisar quando chegar
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function Marketplace() {
  const { data: allProducts = [], isLoading } = trpc.marketplace.products.useQuery();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const cats = new Set((allProducts as CatalogProduct[]).map((p) => p.category));
    return Array.from(cats);
  }, [allProducts]);

  const filtered = useMemo(() => {
    return (allProducts as CatalogProduct[]).filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      return true;
    });
  }, [allProducts, activeCategory]);

  const PANEL_URL = import.meta.env.VITE_PANEL_URL ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5f0e8" }}>

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-stone-200" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-1" />
            <Link href="/">
              <span className="text-2xl font-bold tracking-[0.2em] text-stone-900 cursor-pointer select-none">
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
        </div>
        {/* Nav secundária */}
        <div className="border-t border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-center gap-10 h-11">
              <button
                onClick={() => setActiveCategory(null)}
                className={`text-sm font-medium transition-colors ${activeCategory === null ? "text-stone-900 border-b-2 border-stone-900 pb-0.5" : "text-stone-500 hover:text-stone-900"}`}
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

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "340px" }}
      >
        {/* Fundo escuro com overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-stone-900/65" />
        {/* Conteúdo */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center py-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4">
            A SUA VITRINE PREMIUM DE<br />
            <span className="text-stone-300">PRODUTOS EXCLUSIVOS.</span>
          </h1>
          <p className="text-stone-300 text-base sm:text-lg max-w-2xl mb-8">
            Crie catálogos prontos, gerencie estoque e finalize vendas com a simplicidade
            e a sofisticação que seu negócio merece. Permupay transforma sua vitrine.
          </p>
          <button
            onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3 rounded-lg border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-stone-900 transition-colors"
          >
            Explorar Catálogo Privado
          </button>
        </div>
      </section>

      {/* ── FILTROS DE CATEGORIA ──────────────────────────────────────────── */}
      {availableCategories.length > 0 && (
        <div className="border-b border-stone-200 bg-white/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
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

      {/* ── VITRINE DE PRODUTOS ───────────────────────────────────────────── */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Vitrine de Destaques</h2>
          {!isLoading && (
            <p className="text-sm text-stone-500 mt-1">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-lg font-semibold text-stone-700 mb-2">Vitrine em breve</h3>
            <p className="text-stone-500 mb-6">Estamos preparando os produtos. Volte em breve!</p>
            <Link href="/desejos">
              <button className="px-6 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors flex items-center gap-2 mx-auto">
                <Heart className="w-4 h-4" />
                Cadastrar na Lista de Desejos
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard key={(p as CatalogProduct).id} product={p as CatalogProduct} />
            ))}
          </div>
        )}
      </main>

      {/* ── SEÇÃO LISTA DE DESEJOS ────────────────────────────────────────── */}
      <section className="py-14" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-stone-900 mb-2">
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-stone-500 mb-8">Peça o produto que você deseja!</p>
          <Link href="/desejos">
            <button className="px-8 py-3 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 transition-colors flex items-center gap-2 mx-auto">
              <Heart className="w-4 h-4" />
              Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ── RODAPÉ ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Links */}
            <nav className="flex items-center gap-6 text-sm text-stone-500">
              <button
                onClick={() => setActiveCategory(null)}
                className="hover:text-stone-900 transition-colors"
              >
                Catálogo
              </button>
              <Link href="/desejos">
                <span className="hover:text-stone-900 transition-colors cursor-pointer">Lista de Desejos</span>
              </Link>
              <a
                href={`${PANEL_URL}/login`}
                className="hover:text-stone-900 transition-colors"
              >
                Entrar
              </a>
            </nav>
            {/* Copyright */}
            <p className="text-xs text-stone-400">
              © {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
