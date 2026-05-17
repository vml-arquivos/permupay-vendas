/**
 * Marketplace.tsx — Vitrine Pública PermuPay
 * Layout REFATORADO seguindo modelo premium:
 * - Fundo creme (#f0ebe0)
 * - Header: logo centralizado, nav escura abaixo
 * - Hero: imagem de fundo com perfumes reais + flores, overlay escuro
 * - Grid de 4 colunas com cards compactos (foto + info + 2 botões CTA)
 * - Seção de Lista de Desejos com formulário inline
 * - Footer limpo
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, Zap, CreditCard, FileText, MessageCircle } from "lucide-react";

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

function ProductSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: "#fff", border: "1px solid #e8e0d0" }}>
      <div className="flex gap-3 p-3">
        <div className="w-20 h-20 rounded-xl shrink-0" style={{ backgroundColor: "#e8e0d0" }} />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-2.5 rounded w-14" style={{ backgroundColor: "#e8e0d0" }} />
          <div className="h-3.5 rounded w-full" style={{ backgroundColor: "#e8e0d0" }} />
          <div className="h-3 rounded w-3/4" style={{ backgroundColor: "#e8e0d0" }} />
        </div>
      </div>
      <div className="px-3 pb-3 space-y-2">
        <div className="h-8 rounded-lg" style={{ backgroundColor: "#e8e0d0" }} />
        <div className="h-8 rounded-lg" style={{ backgroundColor: "#e8e0d0" }} />
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const stockStatus = getStockStatus(product);
  const inStock = stockStatus !== "out_of_stock";
  const pix = displayPricePix(product);
  const card = (product.suggestedPriceCard ?? 0) > 0 ? product.suggestedPriceCard : null;
  const installments = product.cardInstallments ?? 3;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col hover:shadow-lg transition-shadow" style={{ backgroundColor: "#fff", border: "1px solid #e8e0d0" }}>
      <Link href={`/vitrine/${product.id}`}>
        <div className="flex gap-3 p-3 cursor-pointer">
          <div className="w-20 h-20 rounded-xl shrink-0 overflow-hidden relative flex items-center justify-center" style={{ backgroundColor: "#f5f0e8" }}>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl select-none">✨</span>
            )}
            {product.promoTag && (
              <span className="absolute top-1 left-1 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ backgroundColor: "#c0392b" }}>
                {product.promoTag}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#8a7a6a" }}>
              {CATEGORY_META[product.category]?.label ?? product.category}
            </span>
            <h3 className="font-semibold text-sm leading-snug mt-0.5 line-clamp-2" style={{ color: "#1a1a1a" }}>
              {product.name}
            </h3>
            {product.shortDescription && (
              <p className="text-xs line-clamp-2 mt-1 leading-relaxed" style={{ color: "#7a6a5a" }}>
                {product.shortDescription}
              </p>
            )}
            {inStock && (
              <p className="text-xs mt-1" style={{ color: "#5a4a3a" }}>
                Em Estoque: {product.stockQuantity}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 flex flex-col gap-2 mt-auto">
        {inStock ? (
          <>
            {pix !== null ? (
              <div>
                <span className="text-base font-black" style={{ color: "#1a1a1a" }}>
                  {formatBRL(pix)}
                </span>
                {card !== null && installments > 1 && (
                  <span className="text-[10px] ml-1.5" style={{ color: "#8a7a6a" }}>
                    ou {installments}x {formatBRL(card / installments)}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: "#8a7a6a" }}>Consulte o preço</p>
            )}

            {(product.pixLink || product.pixKey) && (
              <a
                href={product.pixLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:opacity-85 transition-opacity"
                style={{ backgroundColor: "#c8b89a", color: "#1a1a1a" }}
              >
                <Zap className="w-3 h-3" />
                CTA Pagar com PIX
              </a>
            )}

            {product.cardPaymentUrl && (
              <a
                href={product.cardPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:opacity-85 transition-opacity"
                style={{ backgroundColor: "#3d3530", color: "#fff" }}
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
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{ borderColor: "#c8b89a", color: "#3d3530" }}
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
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "#3d7a4a", color: "#fff" }}
              >
                <MessageCircle className="w-3 h-3" />
                Consultar via WhatsApp
              </a>
            )}

            {stockStatus === "low_stock" && (
              <p className="text-center text-[10px] font-semibold" style={{ color: "#b8860b" }}>
                ⚠ Últimas unidades
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-medium" style={{ color: "#8a7a6a" }}>Produto indisponível</p>
            <Link href="/desejos">
              <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed text-xs font-medium hover:opacity-80 transition-opacity" style={{ borderColor: "#c8b89a", color: "#8a7a6a" }}>
                <Heart className="w-3 h-3" />
                Avisar quando chegar
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [wishlistForm, setWishlistForm] = useState({ product: "", brand: "", model: "", description: "" });

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

  // Hero: perfumes luxuosos em superfície de mármore com flores
  const HERO_IMAGE = "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1800&q=90";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f0ebe0" }}>

      {/* HEADER */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex-1" />
          <Link href="/vitrine">
            <span className="text-xl font-black tracking-widest cursor-pointer select-none" style={{ color: "#1a1a1a" }}>
              PERMUPAY
            </span>
          </Link>
          <div className="flex-1 flex justify-end gap-2">
            <a
              href="/dashboard"
              className="hidden sm:inline-flex px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: "#8a7a6a" }}
            >
              Dashboard
            </a>
            <a
              href={`${PANEL_URL}/login`}
              className="px-5 py-1.5 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ borderColor: "#1a1a1a", color: "#1a1a1a" }}
            >
              Entrar
            </a>
          </div>
        </div>

        {/* Nav escura */}
        <nav style={{ backgroundColor: "#2a2218" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-10 h-11">
              <button
                onClick={() => setActiveCategory(null)}
                className="text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: activeCategory === null ? "#f0ebe0" : "#a89880" }}
              >
                Catálogo
              </button>
              <Link href="/desejos">
                <span className="text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: "#a89880" }}>
                  Vender
                </span>
              </Link>
              <a href={`${PANEL_URL}/login`} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: "#a89880" }}>
                Gerenciar
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ minHeight: "320px" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
        />
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(28,22,14,0.62)" }} />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center py-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-4" style={{ color: "#fff" }}>
            A SUA VITRINE PREMIUM DE<br />
            <span style={{ color: "#c8b89a" }}>PRODUTOS EXCLUSIVOS.</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mb-8" style={{ color: "#d4c9b8" }}>
            Crie catálogos prontos, gerencie estoque e finalize vendas com a simplicidade
            e a sofisticação que seu negócio merece. Permupay transforma sua vitrine.
          </p>
          <button
            onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3 rounded-lg border-2 text-sm font-semibold hover:opacity-85 transition-opacity"
            style={{ borderColor: "#c8b89a", color: "#c8b89a", backgroundColor: "transparent" }}
          >
            Explorar Catálogo Privado
          </button>
        </div>
      </section>

      {/* FILTROS */}
      <div className="py-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className="px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={activeCategory === null ? { backgroundColor: "#2a2218", color: "#fff" } : { backgroundColor: "#e0d8cc", color: "#5a4a3a" }}
          >
            Fragrâncias
          </button>
          {availableCategories.filter((c) => c !== "PERFUME").map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={activeCategory === cat ? { backgroundColor: "#2a2218", color: "#fff" } : { backgroundColor: "#e0d8cc", color: "#5a4a3a" }}
            >
              {CATEGORY_META[cat]?.icon} {CATEGORY_META[cat]?.label ?? cat}
            </button>
          ))}
          <button className="px-5 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: "#e0d8cc", color: "#5a4a3a" }}>
            Acessórios
          </button>
          <button className="px-5 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: "#e0d8cc", color: "#5a4a3a" }}>
            Presentes
          </button>
        </div>
      </div>

      {/* VITRINE */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: "#1a1a1a" }}>Vitrine de Destaques</h2>
          {!isLoading && (
            <p className="text-sm" style={{ color: "#8a7a6a" }}>
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#e0d8cc" }}>
              <span className="text-3xl">✨</span>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#3a2a1a" }}>Vitrine em breve</h3>
            <p className="mb-6" style={{ color: "#8a7a6a" }}>Estamos preparando os produtos. Volte em breve!</p>
            <Link href="/desejos">
              <button className="px-6 py-2.5 rounded-lg border text-sm font-medium hover:opacity-80 transition-opacity inline-flex items-center gap-2" style={{ borderColor: "#c8b89a", color: "#5a4a3a" }}>
                <Heart className="w-4 h-4" />
                Cadastrar na Lista de Desejos
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>

      {/* LISTA DE DESEJOS */}
      <section className="py-16" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Sua Lista de Desejos Personalizada</h2>
          <p className="mb-8" style={{ color: "#8a7a6a" }}>Peça o produto que você deseja!</p>
          <div className="flex flex-wrap gap-3 items-center justify-center">
            {(["Produto", "Marca", "Modelo", "Descrição"] as const).map((placeholder) => {
              const key = placeholder.toLowerCase() as keyof typeof wishlistForm;
              return (
                <input
                  key={placeholder}
                  type="text"
                  placeholder={placeholder}
                  value={wishlistForm[key]}
                  onChange={(e) => setWishlistForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="px-4 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: "#c8b89a", backgroundColor: "#fff", color: "#1a1a1a", minWidth: "130px" }}
                />
              );
            })}
            <Link href="/desejos">
              <button className="px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide hover:opacity-80 transition-opacity whitespace-nowrap" style={{ backgroundColor: "#2a2218", color: "#fff" }}>
                Registrar Demanda
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t" style={{ backgroundColor: "#f0ebe0", borderColor: "#d8d0c0" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav className="flex items-center gap-6 text-sm" style={{ color: "#8a7a6a" }}>
              <button onClick={() => setActiveCategory(null)} className="hover:opacity-70 transition-opacity">Catálogo</button>
              <Link href="/desejos"><span className="hover:opacity-70 transition-opacity cursor-pointer">Vender</span></Link>
              <a href={`${PANEL_URL}/login`} className="hover:opacity-70 transition-opacity">Gerenciar</a>
              <a href={`${PANEL_URL}/login`} className="hover:opacity-70 transition-opacity">Entrar</a>
            </nav>
            <p className="text-xs" style={{ color: "#a89880" }}>
              © {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
