/**
 * Marketplace.tsx — Vitrine Pública PermuPay
 *
 * Página principal de e-commerce com:
 * - Cabeçalho fixo com logo, busca e navegação
 * - Banner hero com chamada para ação
 * - Seção de categorias em destaque
 * - Grade de produtos com filtros e busca
 * - Rodapé completo com redes sociais e links
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ShoppingBag,
  Heart,
  LogIn,
  Truck,
  Shield,
  CreditCard,
  Sparkles,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  MessageCircle,
  Package,
  Zap,
  Clock,
  FileText,
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
  finalUnitCostBrl: number;
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

const PROMO_COLORS: Record<string, string> = {
  "MAIS VENDIDO": "bg-amber-500 text-white",
  "PROMOÇÃO":     "bg-red-500 text-white",
  "LANÇAMENTO":   "bg-blue-600 text-white",
  "OFERTA":       "bg-green-600 text-white",
  "NOVO":         "bg-indigo-600 text-white",
};

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(p: CatalogProduct): StockStatus {
  const qty = p.stockQuantity ?? 0;
  const min = p.minimumStock ?? 0;
  if (qty <= 0) return "out_of_stock";
  if (min > 0 && qty <= min) return "low_stock";
  return "in_stock";
}

function displayPrice(p: CatalogProduct): number {
  if (p.suggestedPricePix > 0) return p.suggestedPricePix;
  if (p.suggestedPrice > 0) return p.suggestedPrice;
  return p.finalUnitCostBrl;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-5 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-10 bg-gray-200 rounded-xl mt-4" />
      </div>
    </div>
  );
}

// ── Card de Produto ───────────────────────────────────────────────────────────

function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus = getStockStatus(product);
  const inStock = stockStatus !== "out_of_stock";
  const isLowStock = stockStatus === "low_stock";
  const promoColor = product.promoTag
    ? (PROMO_COLORS[product.promoTag] ?? "bg-gray-700 text-white")
    : null;

  return (
    <div className={`group bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col ${inStock ? "border-gray-100 hover:border-blue-200" : "border-gray-100 opacity-80"}`}>
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${!inStock ? "grayscale" : ""}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
            <Package className="w-16 h-16" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {!inStock && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-800/90 text-white backdrop-blur-sm">
              Sem Estoque
            </span>
          )}
          {inStock && isLowStock && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">
              ⚡ Últimas unidades
            </span>
          )}
          {product.promoTag && inStock && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${promoColor}`}>
              {product.promoTag}
            </span>
          )}
        </div>

        {/* Botão de Lista de Desejos */}
        <Link href="/desejos">
          <button
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-pink-50 hover:text-pink-500"
            title="Adicionar à lista de desejos"
          >
            <Heart className="w-4 h-4" />
          </button>
        </Link>
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          {CATEGORY_META[product.category]?.label ?? product.category}
        </span>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1.5 line-clamp-2">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
            {product.shortDescription}
          </p>
        )}

        {/* Preços e botões */}
        <div className="mt-auto">
          {inStock ? (
            <>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-xl font-bold text-gray-900">{formatBRL(displayPrice(product))}</span>
                {(product.pixLink || product.pixKey) && (
                  <span className="text-xs text-green-600 font-medium">no PIX</span>
                )}
              </div>
              {product.suggestedPriceCard > 0 && product.cardPaymentUrl && (
                <p className="text-xs text-gray-400 mb-3">
                  ou {formatBRL(product.suggestedPriceCard)} no cartão
                </p>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                {(product.pixLink || product.pixKey) && (
                  <a
                    href={product.pixLink ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
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
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
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
                    className="w-full py-2 px-4 rounded-xl border border-gray-200 hover:border-gray-400 text-gray-700 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2"
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
                    className="w-full py-2.5 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-400 font-medium mb-2">Produto indisponível</p>
              <Link href="/desejos">
                <button className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-pink-400 hover:text-pink-500 text-gray-500 text-sm font-medium transition-colors flex items-center justify-center gap-2">
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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const cats = new Set((allProducts as CatalogProduct[]).map((p) => p.category));
    return Array.from(cats);
  }, [allProducts]);

  const filtered = useMemo(() => {
    return (allProducts as CatalogProduct[]).filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.shortDescription ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCat = !activeCategory || p.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [allProducts, search, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── CABEÇALHO ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-lg font-bold text-gray-900">PermuPay</span>
                  <span className="text-lg font-light text-blue-600"> Vendas</span>
                </div>
              </div>
            </Link>

            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar produtos, marcas, categorias..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href="/desejos">
                <Button variant="ghost" size="sm" className="gap-1.5 hidden sm:flex">
                  <Heart className="w-4 h-4" />
                  <span className="hidden md:inline">Lista de Desejos</span>
                </Button>
              </Link>
              <a href={`${import.meta.env.VITE_PANEL_URL ?? ""}/login`}>
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Entrar</span>
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              Produtos selecionados com os melhores preços
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
              Compre com
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400"> confiança</span>
              <br />e praticidade
            </h1>
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Perfumes importados, eletrônicos e muito mais. Pagamento via PIX, cartão ou boleto. Entrega rápida para todo o Brasil.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" })}
                className="px-6 py-3 rounded-xl bg-white text-blue-900 font-bold hover:bg-blue-50 transition-colors shadow-lg"
              >
                Ver Produtos
              </button>
              <Link href="/desejos">
                <button className="px-6 py-3 rounded-xl border-2 border-white/40 text-white font-semibold hover:bg-white/10 transition-colors flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Lista de Desejos
                </button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48L1440 48L1440 0C1200 40 960 48 720 40C480 32 240 8 0 0L0 48Z" fill="#f9fafb" />
          </svg>
        </div>
      </section>

      {/* ── DIFERENCIAIS ───────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Truck,   title: "Entrega Rápida",   desc: "Para todo o Brasil" },
              { icon: Shield,  title: "Compra Segura",    desc: "Pagamento protegido" },
              { icon: Zap,     title: "PIX com Desconto", desc: "Pague menos no PIX" },
              { icon: Clock,   title: "Atendimento",      desc: "Seg–Sáb, 9h às 18h" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIAS ─────────────────────────────────────────────────────── */}
      {availableCategories.length > 0 && (
        <section className="py-6 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Comprar por Categoria</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveCategory(null)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeCategory === null
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                🛒 Todos ({(allProducts as CatalogProduct[]).length})
              </button>
              {availableCategories.map((cat) => {
                const meta = CATEGORY_META[cat] ?? { label: cat, icon: "📦" };
                const count = (allProducts as CatalogProduct[]).filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      activeCategory === cat
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── GRADE DE PRODUTOS ──────────────────────────────────────────────── */}
      <section id="produtos" className="flex-1 py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {activeCategory
                  ? `${CATEGORY_META[activeCategory]?.label ?? activeCategory}`
                  : search
                  ? `Resultados para "${search}"`
                  : "Todos os Produtos"}
              </h2>
              {!isLoading && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            {(search || activeCategory) && (
              <button
                onClick={() => { setSearch(""); setActiveCategory(null); }}
                className="text-sm text-blue-600 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {search || activeCategory ? "Nenhum produto encontrado" : "Vitrine em breve"}
              </h3>
              <p className="text-gray-500 mb-6">
                {search || activeCategory
                  ? "Tente outros termos ou remova os filtros."
                  : "Estamos preparando os produtos. Volte em breve!"}
              </p>
              <Link href="/desejos">
                <Button variant="outline" className="gap-2">
                  <Heart className="w-4 h-4" />
                  Cadastrar na Lista de Desejos
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product as CatalogProduct} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── BANNER LISTA DE DESEJOS ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-pink-500 to-rose-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Heart className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Não encontrou o que procura?</h2>
          <p className="text-pink-100 mb-6 max-w-xl mx-auto">
            Cadastre na nossa Lista de Desejos e avisamos quando o produto chegar ou encontrarmos para você.
          </p>
          <Link href="/desejos">
            <button className="px-8 py-3 rounded-xl bg-white text-pink-600 font-bold hover:bg-pink-50 transition-colors shadow-lg">
              Quero ser avisado
            </button>
          </Link>
        </div>
      </section>

      {/* ── RODAPÉ ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Marca */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">PermuPay Vendas</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">
                Sua loja de perfumes importados e eletrônicos com os melhores preços e atendimento personalizado.
              </p>
              <div className="flex gap-3">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gradient-to-br hover:from-pink-500 hover:to-purple-600 flex items-center justify-center transition-all duration-200"
                  title="Instagram">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-all duration-200"
                  title="Facebook">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-green-600 flex items-center justify-center transition-all duration-200"
                  title="WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Categorias */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Categorias</h3>
              <ul className="space-y-2.5">
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <li key={key}>
                    <button
                      onClick={() => { setActiveCategory(key); document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" }); }}
                      className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <ChevronRight className="w-3 h-3" />
                      {meta.icon} {meta.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Links Úteis */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Links Úteis</h3>
              <ul className="space-y-2.5">
                {[
                  { href: "/",        label: "Início",            external: false },
                  { href: "/desejos", label: "Lista de Desejos",    external: false },
                  { href: `${import.meta.env.VITE_PANEL_URL ?? ""}/login`, label: "Área do Vendedor", external: true },
                ].map(({ href, label, external }) => (
                  <li key={label}>
                    {external ? (
                      <a href={href}>
                        <span className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer">
                          <ChevronRight className="w-3 h-3" />
                          {label}
                        </span>
                      </a>
                    ) : (
                      <Link href={href}>
                        <span className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer">
                          <ChevronRight className="w-3 h-3" />
                          {label}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Contato */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Contato</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <Phone className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>(11) 9 9999-9999</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <Mail className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>contato@permupay.com.br</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <MapPin className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <span>Brasil</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <MessageCircle className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                  <a href="https://wa.me/" target="_blank" rel="noopener noreferrer"
                    className="hover:text-green-400 transition-colors">
                    Falar no WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Rodapé inferior */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} PermuPay Vendas. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-green-500" />
                Compra 100% segura
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                PIX · Cartão · Boleto
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
