/**
 * Marketplace.tsx — Vitrine Pública PermuPay
 * Layout: EXATAMENTE o modelo de referência premium
 * - Fundo bege/creme (#f5f0e8)
 * - Logo PERMUPAY centralizado no header
 * - Hero com imagem de fundo de perfumes (Unsplash)
 * - Cards horizontais: foto à esquerda, conteúdo à direita
 * - Filtros de categoria como pills
 * - Seção de Lista de Desejos
 * - Footer limpo
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, Zap, CreditCard, FileText, MessageCircle } from "lucide-react";

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

function getStockStatus(p: CatalogProduct): "in_stock" | "low_stock" | "out_of_stock" {
  const qty = p.stockQuantity ?? 0;
  const min = p.minimumStock ?? 0;
  if (qty <= 0) return "out_of_stock";
  if (min > 0 && qty <= min) return "low_stock";
  return "in_stock";
}

function displayPricePix(p: CatalogProduct): number | null {
  if ((p.suggestedPricePix ?? 0) > 0) return p.suggestedPricePix;
  if ((p.suggestedPrice ?? 0) > 0) return p.suggestedPrice;
  return null;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 animate-pulse flex h-40">
      <div className="w-36 shrink-0 bg-stone-200" />
      <div className="flex-1 p-4 space-y-3">
        <div className="h-3 bg-stone-200 rounded w-20" />
        <div className="h-5 bg-stone-200 rounded w-3/4" />
        <div className="h-3 bg-stone-200 rounded w-1/2" />
        <div className="h-8 bg-stone-200 rounded-xl mt-4 w-32" />
      </div>
    </div>
  );
}

// ── Card de Produto (horizontal, modelo de referência) ────────────────────────
function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus = getStockStatus(product);
  const inStock = stockStatus !== "out_of_stock";
  const pix = displayPricePix(product);
  const card = (product.suggestedPriceCard ?? 0) > 0 ? product.suggestedPriceCard : null;
  const boleto = (product.suggestedPriceBoleto ?? 0) > 0 ? product.suggestedPriceBoleto : null;
  const installments = product.cardInstallments ?? 3;
  const boletoMonths = product.boletoMonths ?? 3;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-shadow flex">
      {/* Foto à esquerda */}
      <Link href={`/vitrine/${product.id}`}>
        <div className="w-36 sm:w-44 shrink-0 relative cursor-pointer bg-stone-50 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-4xl select-none">✨</span>
          )}
          {product.promoTag && (
            <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              {product.promoTag}
            </span>
          )}
          {stockStatus === "low_stock" && (
            <span className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Últimas unidades
            </span>
          )}
        </div>
      </Link>

      {/* Conteúdo à direita */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
            {CATEGORY_META[product.category]?.label ?? product.category}
          </span>
          <Link href={`/vitrine/${product.id}`}>
            <h3 className="font-semibold text-stone-900 text-sm leading-snug mt-0.5 line-clamp-2 hover:text-stone-600 cursor-pointer transition-colors">
              {product.name}
            </h3>
          </Link>
          {product.shortDescription && (
            <p className="text-xs text-stone-500 line-clamp-1 mt-1">
              {product.shortDescription}
            </p>
          )}
        </div>

        {/* Preços e botões */}
        {inStock ? (
          <div className="mt-3">
            {/* Preço PIX em destaque */}
            {pix !== null ? (
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-lg font-bold text-stone-900">{formatBRL(pix)}</span>
                {(product.pixLink || product.pixKey) && (
                  <span className="text-xs text-emerald-600 font-semibold">no PIX</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-400 italic mb-1">Consulte o preço</p>
            )}

            {/* Preços secundários compactos */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
              {card !== null && (
                <span className="text-xs text-stone-400">
                  {installments > 1
                    ? `${installments}x de ${formatBRL(card / installments)} no cartão`
                    : `${formatBRL(card)} no cartão`}
                </span>
              )}
              {boleto !== null && (
                <span className="text-xs text-stone-400">
                  {boletoMonths > 1
                    ? `${boletoMonths}x de ${formatBRL(boleto / boletoMonths)} no boleto`
                    : `${formatBRL(boleto)} no boleto`}
                </span>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex flex-wrap gap-2">
              {(product.pixLink || product.pixKey) && (
                <a
                  href={product.pixLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-700 text-white text-xs font-semibold transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Pagar com PIX
                </a>
              )}
              {product.cardPaymentUrl && (
                <a
                  href={product.cardPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
                >
                  <CreditCard className="w-3 h-3" />
                  Pagar com Cartão
                </a>
              )}
              {product.boletoUrl && (
                <a
                  href={product.boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-200 hover:border-stone-400 text-stone-600 text-xs font-medium transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Gerar Boleto
                </a>
              )}
              {!product.pixLink && !product.pixKey && !product.cardPaymentUrl && !product.boletoUrl && (
                <a
                  href="https://wa.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  Consultar via WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-stone-400 font-medium mb-2">Produto indisponível</p>
            <Link href="/desejos">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-dashed border-stone-300 hover:border-stone-500 hover:text-stone-700 text-stone-400 text-xs font-medium transition-colors">
                <Heart className="w-3 h-3" />
                Avisar quando chegar
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function Marketplace() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const productsQuery = trpc.marketplace.products.useQuery();
  const products = (productsQuery.data ?? []) as CatalogProduct[];
  const isLoading = productsQuery.isLoading;

  const availableCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products]
  );

  const filtered = useMemo(
    () => (activeCategory ? products.filter((p) => p.category === activeCategory) : products),
    [products, activeCategory]
  );

  const PANEL_URL = import.meta.env.VITE_PANEL_URL ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f5f0e8" }}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: "#f5f0e8" }}>
        {/* Linha principal: logo + botão Entrar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
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

      {/* ── HERO com imagem de fundo ─────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "340px" }}>
        {/* Imagem de fundo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1600&q=80')",
          }}
        />
        {/* Overlay escuro */}
        <div className="absolute inset-0 bg-stone-900/65" />
        {/* Conteúdo centralizado */}
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
            onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3 rounded-lg border-2 border-white text-white text-sm font-semibold hover:bg-white hover:text-stone-900 transition-colors"
          >
            Explorar Catálogo Privado
          </button>
        </div>
      </section>

      {/* ── FILTROS DE CATEGORIA ─────────────────────────────────────────── */}
      {availableCategories.length > 0 && (
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
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Vitrine de Destaques</h2>
          {!isLoading && (
            <p className="text-sm text-stone-500">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-lg font-semibold text-stone-700 mb-2">Vitrine em breve</h3>
            <p className="text-stone-500 mb-6">Estamos preparando os produtos. Volte em breve!</p>
            <Link href="/desejos">
              <button className="px-6 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-100 transition-colors inline-flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Cadastrar na Lista de Desejos
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>

      {/* ── SEÇÃO LISTA DE DESEJOS ───────────────────────────────────────── */}
      <section className="py-16" style={{ backgroundColor: "#f5f0e8" }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-stone-900 mb-2">
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-stone-500 mb-8">Peça o produto que você deseja!</p>
          <Link href="/desejos">
            <button className="px-8 py-3 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 transition-colors inline-flex items-center gap-2">
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
              <button onClick={() => setActiveCategory(null)} className="hover:text-stone-900 transition-colors">
                Catálogo
              </button>
              <Link href="/desejos">
                <span className="hover:text-stone-900 transition-colors cursor-pointer">Lista de Desejos</span>
              </Link>
              <a href={`${PANEL_URL}/login`} className="hover:text-stone-900 transition-colors">
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
