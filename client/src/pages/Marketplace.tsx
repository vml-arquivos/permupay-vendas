/**
 * Marketplace.tsx — Vitrine Pública PermuPay (v4 — Editorial Luxury)
 *
 * Design: branco puro, tipografia Cormorant Garamond + DM Sans,
 * grid assimétrico, hover states cinematográficos, contraste preciso.
 * Lógica de negócio 100% intacta.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

interface CatalogProduct {
  id: number; name: string; category: string; categoryLabel: string | null;
  shortDescription: string | null; description: string | null;
  imageUrl: string | null; promoTag: string | null;
  suggestedPrice: number; suggestedPricePix: number;
  suggestedPriceCard: number; suggestedPriceBoleto: number;
  stockQuantity: number; minimumStock: number;
  paymentPlatform: string | null; pixKey: string | null;
  pixLink: string | null; cardPaymentUrl: string | null;
  boletoUrl: string | null; cardInstallments?: number | null; boletoMonths?: number | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT: Record<string, string> = {
  CELULAR: "Celulares", ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias", OUTRO: "Outros",
};

const pixPrice = (p: CatalogProduct) =>
  (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix :
  (p.suggestedPrice ?? 0) > 0    ? p.suggestedPrice : null;
const cardPrice = (p: CatalogProduct) =>
  (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : null;
const hasStock = (p: CatalogProduct) => (p.stockQuantity ?? 0) > 0;
const isLow    = (p: CatalogProduct) => (p.minimumStock ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 0);

// ── Fontes Google injetadas uma vez ──────────────────────────────────────────
// Carrega famílias Poppins e Montserrat em vários pesos para uma tipografia moderna
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap";

if (typeof document !== "undefined" && !document.getElementById("mkt-fonts")) {
  const link = document.createElement("link");
  link.id = "mkt-fonts";
  link.rel = "stylesheet";
  link.href = FONT_LINK;
  document.head.appendChild(link);
}

// Define fontes serif e sans: ambas usam Montserrat/Poppins para evitar contraste excessivo entre títulos e texto
const SERIF = "'Montserrat', 'Poppins', sans-serif";
const SANS  = "'Poppins', 'Montserrat', sans-serif";

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ size = 86 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt="Shop PermuPay"
      style={{ height: size, width: "auto", maxWidth: 180 }}
      className="shrink-0 object-contain"
    />
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square bg-neutral-100 mb-5 rounded-sm" />
      <div className="space-y-2.5">
        <div className="h-2 bg-neutral-100 rounded-full w-20" />
        <div className="h-4 bg-neutral-100 rounded-full w-3/4" />
        <div className="h-3 bg-neutral-100 rounded-full w-1/3 mt-3" />
      </div>
    </div>
  );
}

// ── Card de produto ───────────────────────────────────────────────────────────
function ProductCard({ product: p, index }: { product: CatalogProduct; index: number }) {
  const stock = hasStock(p);
  const low   = isLow(p);
  const pix   = pixPrice(p);
  const card  = cardPrice(p);
  const inst  = Math.max(1, Math.round(p.cardInstallments ?? 3));

  // Cards alternados: alguns com proporção portrait, outros square
  const isPortrait = index % 5 === 0 || index % 5 === 3;

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article
        className={`group cursor-pointer ${!stock ? "opacity-40 pointer-events-none" : ""}`}
        style={{ fontFamily: SANS }}
      >
        {/* ── Imagem ── */}
        <div
          className="relative overflow-hidden bg-[#F8F8F6] mb-4 rounded-sm"
          style={{ aspectRatio: isPortrait ? "3/4" : "1/1" }}
        >
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="w-full h-full object-contain p-6 transition-all duration-700 ease-out group-hover:scale-[1.06] group-hover:p-4"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="w-8 h-8 text-neutral-200" />
              <span className="text-[9px] text-neutral-300 tracking-[0.3em] uppercase">Sem imagem</span>
            </div>
          )}

          {/* Badges */}
          {p.promoTag && stock && (
            <span
              className="absolute top-3 left-3 text-[8px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1"
              style={{ backgroundColor: "#111", color: "#fff" }}
            >
              {p.promoTag}
            </span>
          )}
          {low && stock && (
            <span className="absolute top-3 right-3 text-[8px] font-medium tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              Últimas unidades
            </span>
          )}

          {/* Overlay hover */}
          {stock && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/4 transition-all duration-500" />
          )}

          {/* CTA deslizante */}
          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div
                className="py-3.5 text-[9px] font-semibold tracking-[0.22em] uppercase text-center flex items-center justify-center gap-2"
                style={{ backgroundColor: "#111", color: "#fff", fontFamily: SANS }}
              >
                Ver produto <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          )}

          {!stock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[9px] tracking-[0.3em] uppercase border border-neutral-200 px-3 py-1.5"
                style={{ color: "#bbb", backgroundColor: "rgba(255,255,255,0.8)", fontFamily: SANS }}
              >
                Indisponível
              </span>
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="space-y-1.5 px-0.5">
          <p
            className="text-[9px] font-medium tracking-[0.3em] uppercase text-neutral-400"
            style={{ fontFamily: SANS }}
          >
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>

          <h3
            className="leading-snug line-clamp-2 text-neutral-900 transition-colors duration-300 group-hover:text-neutral-500"
            style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {p.name}
          </h3>

          {p.shortDescription && (
            <p className="text-[11px] text-neutral-400 line-clamp-1 font-light" style={{ fontFamily: SANS }}>
              {p.shortDescription}
            </p>
          )}

          {/* Preço */}
          <div className="pt-2">
            {stock && pix ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-neutral-900 font-semibold"
                    style={{ fontFamily: SANS, fontSize: "1rem", letterSpacing: "-0.02em" }}
                  >
                    {fmt(pix)}
                  </span>
                  <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-emerald-600">PIX</span>
                </div>
                {card && inst > 1 && (
                  <p className="text-[10px] text-neutral-400 mt-0.5 font-light" style={{ fontFamily: SANS }}>
                    ou {inst}× de {fmt(card / inst)} no cartão
                  </p>
                )}
              </div>
            ) : stock ? (
              <span className="text-xs text-neutral-400 italic" style={{ fontFamily: SERIF }}>
                Consulte o preço
              </span>
            ) : (
              <Link href="/desejos">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-neutral-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors"
                  style={{ fontFamily: SANS }}
                >
                  <Heart className="w-3 h-3" /> Avisar quando chegar
                </button>
              </Link>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Marketplace() {
  const [cat, setCat] = useState<string | null>(null);
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const cats     = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const filtered = useMemo(() => cat ? products.filter((p) => p.category === cat) : products, [products, cat]);
  const featured = products.find((p) => p.imageUrl && hasStock(p));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#ffffff", fontFamily: SANS }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b border-neutral-100"
        style={{ backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-16 h-24 flex items-center justify-between gap-8">
          <Link href="/vitrine">
            <div className="flex items-center gap-3 cursor-pointer group select-none">
              <Logo size={92} />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <button
              onClick={() => setCat(null)}
              className="text-xs font-medium tracking-[0.18em] uppercase transition-colors pb-px border-b"
              style={{ color: cat === null ? "#111" : "#aaa", borderColor: cat === null ? "#111" : "transparent" }}
            >
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-xs font-medium tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-800 cursor-pointer transition-colors">
                Lista de Desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`} className="text-xs font-medium tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-800 transition-colors">
              Gerenciar
            </a>
          </nav>

          <a
            href={`${PANEL}/login`}
            className="text-xs font-semibold tracking-[0.2em] uppercase px-5 py-2.5 transition-all duration-200"
            style={{ border: "1px solid #111", color: "#111", backgroundColor: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#111"; }}
          >
            Entrar
          </a>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-20 lg:py-32 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Copy */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-neutral-300" />
            <span
              className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-500"
              style={{ fontFamily: SANS }}
            >
              Catálogo Exclusivo · Shoop PermuPay
            </span>
            </div>

            <h1
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(2.8rem, 5.5vw, 4.4rem)",
                fontWeight: 700,
                color: "#111",
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
              }}
            >
              A sua vitrine
              <br />
              <span
                style={{
                  color: "#b45309",
                  fontWeight: 700,
                }}
              >
                dos desejos
              </span>
            </h1>

            <p className="text-neutral-500 text-sm leading-relaxed max-w-sm font-light" style={{ fontFamily: SANS }}>
              Produtos selecionados. Preços transparentes.<br />
              Compra simples, segura e sofisticada.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3.5 text-[9px] font-semibold tracking-[0.22em] uppercase transition-all duration-200"
                style={{ backgroundColor: "#111", color: "#fff" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
              >
                Explorar catálogo
              </button>
              <Link href="/desejos">
                <button
                  className="px-8 py-3.5 text-[9px] font-semibold tracking-[0.22em] uppercase border border-neutral-200 text-neutral-600 hover:border-neutral-400 transition-all duration-200"
                  style={{ fontFamily: SANS }}
                >
                  Lista de desejos
                </button>
              </Link>
            </div>
          </div>

          {/* Visual hero */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[400px]">
            {/* Círculos decorativos */}
            <div className="absolute w-[340px] h-[340px] rounded-full border border-neutral-100 animate-[spin_40s_linear_infinite]" />
            <div className="absolute w-[240px] h-[240px] rounded-full border border-neutral-100/70" />
            <div className="absolute top-8 right-16 w-2 h-2 rounded-full bg-amber-200" />
            <div className="absolute bottom-16 left-12 w-1 h-1 rounded-full bg-neutral-300" />

            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="relative z-10 cursor-pointer group">
                  <div
                    className="w-64 h-64 rounded-sm flex items-center justify-center overflow-hidden transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundColor: "#F8F8F6" }}
                  >
                    <img
                      src={featured.imageUrl!}
                      alt={featured.name}
                      className="w-full h-full object-contain p-8"
                    />
                  </div>

                  {/* Float card */}
                  <div
                    className="absolute -bottom-8 -right-10 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.10)] p-5 min-w-[180px] z-20 border border-neutral-50"
                  >
                    <p className="text-[8px] tracking-[0.25em] uppercase text-neutral-400 mb-1.5 line-clamp-1" style={{ fontFamily: SANS }}>
                      {featured.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p className="text-xl font-semibold text-neutral-900" style={{ fontFamily: SANS, letterSpacing: "-0.02em" }}>
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "—"}
                    </p>
                    {pixPrice(featured) && (
                      <p className="text-[8px] text-emerald-600 font-semibold tracking-[0.2em] mt-1 uppercase flex items-center gap-1" style={{ fontFamily: SANS }}>
                        <Sparkles className="w-2.5 h-2.5" /> via pix
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative z-10 w-64 h-64 flex items-center justify-center rounded-sm" style={{ backgroundColor: "#F8F8F6" }}>
                <ShoppingBag className="w-14 h-14 text-neutral-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FILTROS DE CATEGORIA ════════════════════════════════════════════ */}
      {cats.length > 1 && (
        <div className="border-b border-neutral-100 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-16 h-12 flex items-center gap-10 overflow-x-auto no-scrollbar">
            {[{ key: null, label: "Todos" }, ...cats.map((c) => ({ key: c, label: CAT[c] || c }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCat(key)}
                className="shrink-0 text-[9px] font-medium tracking-[0.28em] uppercase pb-px border-b transition-all duration-200"
                style={{
                  color: cat === key ? "#111" : "#aaa",
                  borderColor: cat === key ? "#111" : "transparent",
                  fontFamily: SANS,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ CATÁLOGO ════════════════════════════════════════════════════════ */}
      <main id="catalogo" className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-16 py-20">

        {/* Título da seção */}
        <div className="flex items-end justify-between mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-neutral-300" />
              <p className="text-[9px] font-medium tracking-[0.35em] uppercase text-neutral-400" style={{ fontFamily: SANS }}>
                Coleção em destaque
              </p>
            </div>
            <h2
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(1.8rem, 3vw, 2.8rem)",
                fontWeight: 700,
                color: "#111",
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
              }}
            >
              Vitrine dos <span style={{ color: "#92400e", fontWeight: 700 }}>Desejos</span>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p className="text-[10px] text-neutral-400 tracking-wider shrink-0" style={{ fontFamily: SANS }}>
              {filtered.length} {filtered.length !== 1 ? "produtos" : "produto"}
            </p>
          )}
        </div>

        {/* Grid de produtos */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-14">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-40 space-y-5">
            <p className="text-[9px] tracking-[0.38em] uppercase text-neutral-300" style={{ fontFamily: SANS }}>Em breve</p>
            <h3 style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 300, color: "#78716c" }}>
              Vitrine em preparação
            </h3>
            <p className="text-sm text-neutral-400 font-light" style={{ fontFamily: SANS }}>Novos produtos chegando em breve.</p>
            <Link href="/desejos">
              <button className="mt-6 text-[9px] tracking-[0.2em] uppercase border border-neutral-200 text-neutral-500 px-7 py-3 hover:border-neutral-400 transition-colors inline-flex items-center gap-2" style={{ fontFamily: SANS }}>
                <Heart className="w-3.5 h-3.5" /> Registrar desejo
              </button>
            </Link>
          </div>
        ) : (
          /*
           * Grid masonry-like: mistura de proporções portrait/square
           * via grid auto rows — sem biblioteca extra.
           * Coluna 1: 2 colunas mobile → 3 tablet → 4 desktop
           * Gap generoso para respiro premium
           */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-16">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </main>

      {/* ══ SEPARADOR EDITORIAL ═════════════════════════════════════════════ */}
      {!isLoading && filtered.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4">
          <div className="flex items-center gap-6">
            <div className="flex-1 h-px bg-neutral-100" />
            <span className="text-[8px] tracking-[0.4em] uppercase text-neutral-300" style={{ fontFamily: SANS }}>
              Shoop PermuPay
            </span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>
        </div>
      )}

      {/* ══ BANNER LISTA DE DESEJOS ═════════════════════════════════════════ */}
      <section
        className="border-t border-neutral-100 py-28"
        style={{ backgroundColor: "#FAFAF8" }}
      >
        <div className="max-w-lg mx-auto px-6 text-center space-y-7">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-neutral-200 bg-white mx-auto"
          >
            <Heart className="w-5 h-5 text-neutral-400" />
          </div>

          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(1.5rem, 3vw, 2.1rem)",
              fontWeight: 700,
              color: "#111",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Sua Lista de Desejos
            <br />
            <span style={{ fontWeight: 700 }}>Personalizada</span>
          </h2>

          <p className="text-sm text-neutral-500 leading-relaxed font-light max-w-xs mx-auto" style={{ fontFamily: SANS }}>
            Não encontrou o que procura? Registre sua demanda e entraremos em contato quando disponível.
          </p>

          <Link href="/desejos">
            <button
              className="mt-2 px-10 py-4 text-[9px] font-semibold tracking-[0.25em] uppercase inline-flex items-center gap-2.5 transition-all duration-200"
              style={{ backgroundColor: "#111", color: "#fff", fontFamily: SANS }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
            >
              <Heart className="w-3.5 h-3.5" /> Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ══ RODAPÉ ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-100 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={52} />
          </div>

          <nav className="flex items-center gap-8">
            <button
              onClick={() => setCat(null)}
              className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-800 transition-colors"
              style={{ fontFamily: SANS }}
            >
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-800 cursor-pointer transition-colors" style={{ fontFamily: SANS }}>
                Lista de Desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`} className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-800 transition-colors" style={{ fontFamily: SANS }}>
              Entrar
            </a>
          </nav>

          <p className="text-[9px] text-neutral-300 tracking-wide" style={{ fontFamily: SANS }}>
            © {new Date().getFullYear()} Permupay Vendas
          </p>
        </div>
      </footer>
    </div>
  );
}
