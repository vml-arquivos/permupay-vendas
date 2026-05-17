/**
 * Marketplace.tsx — Vitrine Pública "Silent Wealth" · Shoop Permupay
 * Refatorado: identidade visual premium, paleta grafite/alabastro, tipografia Montserrat + Lato.
 * Logo Shoop unificada com fundo transparente.
 * LÓGICA DE NEGÓCIO INTACTA — apenas visual alterado.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Heart, ArrowRight, ShoppingBag } from "lucide-react";

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

// ── Logo Shoop Permupay — SVG fundo transparente ──────────────────────────────
function ShoopLogo({ variant = "full", light = false }: { variant?: "full" | "icon"; light?: boolean }) {
  const gold = "#C8B99A";
  const goldMuted = "#8A7A64";
  const textPrimary = light ? "#E8E3D8" : "#E8E3D8";
  const textMuted = light ? "#9A9082" : "#7A7268";

  if (variant === "icon") {
    return (
      <svg width="28" height="28" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Shoop">
        {/* Arco externo superior */}
        <path d="M8 24C8 13.507 16.507 5 27 5" stroke={goldMuted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        {/* Arco externo inferior */}
        <path d="M36 20C36 30.493 27.493 39 17 39" stroke={goldMuted} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        {/* Arco superior interno */}
        <path d="M11 23C11 15.268 17.268 9 25 9C32.732 9 39 15.268 39 23" stroke={gold} strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* Haste vertical direita */}
        <path d="M39 13L39 23" stroke={gold} strokeWidth="2" strokeLinecap="round"/>
        {/* Arco inferior interno */}
        <path d="M33 21C33 28.732 26.732 35 19 35C11.268 35 5 28.732 5 21" stroke={gold} strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* Haste vertical esquerda */}
        <path d="M5 21L5 31" stroke={gold} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }

  return (
    <svg width="130" height="38" viewBox="0 0 130 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Shoop Permupay">
      {/* Ícone */}
      <g transform="translate(0, 1)">
        <path d="M4 20C4 11.163 11.163 4 20 4" stroke={goldMuted} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M32 17C32 25.837 24.837 33 16 33" stroke={goldMuted} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M7 19C7 13.477 11.477 9 17 9C22.523 9 27 13.477 27 19" stroke={gold} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M27 11L27 19" stroke={gold} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M29 18C29 23.523 24.523 28 19 28C13.477 28 9 23.523 9 18" stroke={gold} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M9 18L9 26" stroke={gold} strokeWidth="1.8" strokeLinecap="round"/>
      </g>
      {/* SHOOP */}
      <text x="40" y="21" fontFamily="'Montserrat', sans-serif" fontSize="13" fontWeight="700" letterSpacing="0.15em" fill={textPrimary}>
        SHOOP
      </text>
      {/* PERMUPAY */}
      <text x="40" y="32" fontFamily="'Lato', sans-serif" fontSize="7.5" fontWeight="300" letterSpacing="0.32em" fill={textMuted}>
        PERMUPAY
      </text>
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] bg-[#1E1E1B] mb-4" />
      <div className="space-y-2 px-1">
        <div className="h-2 bg-[#2A2A26] rounded-sm w-14" />
        <div className="h-3.5 bg-[#2A2A26] rounded-sm w-4/5" />
        <div className="h-3 bg-[#2A2A26] rounded-sm w-1/3 mt-2" />
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const low   = isLow(p);
  const pix   = pixPrice(p);
  const card  = cardPrice(p);
  const inst  = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article className={`group cursor-pointer ${!stock ? "opacity-40" : ""}`}>

        {/* Container da imagem */}
        <div
          className="relative overflow-hidden mb-5"
          style={{ aspectRatio: "4/5", background: "linear-gradient(160deg, #1A1A17 0%, #111110 100%)" }}
        >
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="w-full h-full object-contain p-6 mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-[1.04] transition-all duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="w-8 h-8 text-[#3A3A34]" />
              <span
                className="text-[8px] text-[#3A3A34] tracking-[0.3em] uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                Sem imagem
              </span>
            </div>
          )}

          {/* Badge promoção */}
          {p.promoTag && stock && (
            <span
              className="absolute top-3.5 left-3.5 text-[7px] tracking-[0.25em] uppercase text-[#C8B99A] border border-[#C8B99A]/30 bg-[#0F0F0E]/85 backdrop-blur-sm px-2.5 py-1"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              {p.promoTag}
            </span>
          )}

          {/* Badge últimas unidades */}
          {low && stock && (
            <span
              className="absolute top-3.5 right-3.5 text-[7px] text-amber-300/80 border border-amber-500/20 bg-amber-950/60 px-2 py-0.5"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 400 }}
            >
              Últimas
            </span>
          )}

          {/* Overlay indisponível */}
          {!stock && (
            <div className="absolute inset-0 flex items-end p-4 bg-[#0F0F0E]/40">
              <span
                className="text-[8px] tracking-[0.3em] uppercase text-[#5A5A52] border-t border-[#3A3A34]/50 pt-2 w-full"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                Indisponível
              </span>
            </div>
          )}

          {/* CTA deslizante no hover */}
          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
              <div
                className="bg-[#C8B99A] py-3 text-[#0F0F0E] text-[8px] tracking-[0.25em] uppercase text-center flex items-center justify-center gap-1.5"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
              >
                Ver produto <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>

        {/* Info textual */}
        <div className="px-0.5 space-y-2">
          <p
            className="text-[8px] text-[#5A5A52] tracking-[0.3em] uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
          >
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>

          <h3
            className="text-[14px] text-[#E8E3D8] leading-snug line-clamp-2 group-hover:text-[#C8B99A] transition-colors duration-300"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.01em" }}
          >
            {p.name}
          </h3>

          {p.shortDescription && (
            <p
              className="text-[10px] text-[#4A4A44] line-clamp-1"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.02em" }}
            >
              {p.shortDescription}
            </p>
          )}

          <div className="pt-1">
            {stock && pix ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="text-[17px] font-semibold text-[#E8E3D8] tracking-tight"
                    style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, letterSpacing: "-0.01em" }}
                  >
                    {fmt(pix)}
                  </span>
                  <span
                    className="text-[7px] text-[#7EC89A] tracking-[0.2em] uppercase"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
                  >
                    via pix
                  </span>
                </div>
                {card && inst > 1 && (
                  <p
                    className="text-[9px] text-[#4A4A44] mt-0.5"
                    style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
                  >
                    ou {inst}× {fmt(card / inst)} no cartão
                  </p>
                )}
              </>
            ) : stock ? (
              <span
                className="text-xs text-[#4A4A44] italic"
                style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
              >
                Consulte o preço
              </span>
            ) : (
              <Link href="/desejos">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] text-[#5A5A52] hover:text-[#C8B99A] flex items-center gap-1 transition-colors"
                  style={{ fontFamily: "'Lato', sans-serif", fontWeight: 400 }}
                >
                  <Heart className="w-2.5 h-2.5" /> Avisar quando chegar
                </button>
              </Link>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ── Marketplace Principal ─────────────────────────────────────────────────────
export default function Marketplace() {
  const [cat, setCat] = useState<string | null>(null);
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const cats     = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const filtered = useMemo(() => cat ? products.filter((p) => p.category === cat) : products, [products, cat]);
  const featured = useMemo(() => products.find((p) => hasStock(p) && p.imageUrl), [products]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#111110", color: "#E8E3D8", fontFamily: "'Lato', sans-serif" }}
    >

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b border-[#1E1E1B] backdrop-blur-md"
        style={{ backgroundColor: "rgba(17,17,16,0.96)" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-[60px] flex items-center justify-between">

          {/* Logo */}
          <Link href="/vitrine">
            <div className="cursor-pointer select-none">
              <ShoopLogo variant="full" />
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-10">
            <button
              onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
              className="text-[9px] text-[#5A5A52] hover:text-[#E8E3D8] border-b border-transparent hover:border-[#C8B99A]/40 pb-px transition-all"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.22em" }}
            >
              CATÁLOGO
            </button>
            <Link href="/desejos">
              <span
                className="text-[9px] text-[#5A5A52] hover:text-[#E8E3D8] border-b border-transparent hover:border-[#C8B99A]/40 pb-px transition-all cursor-pointer"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.22em" }}
              >
                LISTA DE DESEJOS
              </span>
            </Link>
            <a
              href={`${PANEL}/login`}
              className="text-[8px] px-4 py-2 border border-[#2E2E2A] text-[#7A7268] hover:border-[#C8B99A]/50 hover:text-[#C8B99A] transition-all"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.2em" }}
            >
              ENTRAR
            </a>
          </nav>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1A1A17]" style={{ backgroundColor: "#0D0D0C" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Copy */}
          <div className="space-y-8">
            <p
              className="text-[8px] text-[#5A5A52] tracking-[0.45em] uppercase"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              Catálogo Exclusivo · Shoop PermuPay
            </p>

            <h1
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: "clamp(2.4rem, 5vw, 4rem)",
                fontWeight: 300,
                color: "#E8E3D8",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              A sua vitrine<br />
              <span
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 700,
                  color: "#C8B99A",
                }}
              >
                dos desejos.
              </span>
            </h1>

            <p
              className="text-[#5A5A52] text-[13px] leading-relaxed max-w-xs"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.02em" }}
            >
              Produtos selecionados. Preços transparentes.<br />
              Compra simples, segura e sofisticada.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3 bg-[#C8B99A] text-[#0F0F0E] hover:bg-[#D9CEBA] transition-colors"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.25em" }}
              >
                EXPLORAR CATÁLOGO
              </button>
              <Link href="/desejos">
                <button
                  className="px-8 py-3 border border-[#2E2E2A] text-[#7A7268] hover:border-[#C8B99A]/40 hover:text-[#C8B99A] transition-all"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "8px", letterSpacing: "0.22em" }}
                >
                  LISTA DE DESEJOS
                </button>
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[380px]">
            <div className="absolute w-72 h-72 rounded-full border border-[#2A2A26]/50" />
            <div className="absolute w-52 h-52 rounded-full border border-[#C8B99A]/6" />
            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="relative z-10 cursor-pointer group">
                  <img
                    src={featured.imageUrl!}
                    alt={featured.name}
                    className="w-56 h-56 object-contain mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-105 transition-all duration-700"
                  />
                  <div
                    className="absolute -bottom-4 -right-10 border border-[#2E2E2A] p-4 min-w-[168px] z-20 shadow-2xl"
                    style={{ backgroundColor: "#1A1A17" }}
                  >
                    <p
                      className="text-[7px] text-[#5A5A52] mb-1.5 line-clamp-1 tracking-[0.28em] uppercase"
                      style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
                    >
                      {featured.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p
                      className="text-base text-[#E8E3D8]"
                      style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700 }}
                    >
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "—"}
                    </p>
                    {pixPrice(featured) && (
                      <p
                        className="text-[7px] text-[#7EC89A] mt-1 tracking-wider uppercase"
                        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
                      >
                        via pix
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative z-10 w-56 h-56 flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-[#2A2A26]" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FILTROS ════════════════════════════════════════════════════════ */}
      {cats.length > 1 && (
        <div className="border-b border-[#1A1A17]" style={{ backgroundColor: "#0F0F0E" }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-12 h-11 flex items-center gap-10 overflow-x-auto no-scrollbar">
            {[{ key: null, label: "TODOS" }, ...cats.map((c) => ({ key: c, label: (CAT[c] || c).toUpperCase() }))].map(({ key, label }) => (
              <button
                key={key ?? "__all__"}
                onClick={() => setCat(key)}
                className={`shrink-0 pb-px border-b transition-all text-[8px] ${
                  cat === key ? "text-[#C8B99A] border-[#C8B99A]" : "text-[#4A4A44] border-transparent hover:text-[#7A7268]"
                }`}
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.28em" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ PRODUTOS ════════════════════════════════════════════════════════ */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-16">
          <div>
            <p
              className="text-[7px] text-[#4A4A44] mb-3 tracking-[0.4em] uppercase"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              Coleção em destaque
            </p>
            <h2
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
                fontWeight: 300,
                color: "#E8E3D8",
                lineHeight: 1.1,
              }}
            >
              Vitrine dos{" "}
              <span style={{ fontWeight: 700, color: "#C8B99A" }}>Desejos</span>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p
              className="text-[9px] text-[#4A4A44] shrink-0"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.04em" }}
            >
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-12">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-36 space-y-5">
            <p
              className="text-[9px] text-[#3A3A34] tracking-[0.38em] uppercase"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              Em breve
            </p>
            <h3
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: "2rem",
                fontWeight: 300,
                color: "#5A5A52",
              }}
            >
              Vitrine em preparação
            </h3>
            <p
              className="text-sm text-[#3A3A34]"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.03em" }}
            >
              Novos produtos chegando em breve.
            </p>
            <Link href="/desejos">
              <button
                className="mt-4 text-[8px] tracking-[0.22em] uppercase border border-[#2E2E2A] text-[#5A5A52] px-7 py-3 hover:border-[#C8B99A]/40 hover:text-[#C8B99A] transition-all inline-flex items-center gap-2"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
              >
                <Heart className="w-3.5 h-3.5" /> REGISTRAR DESEJO
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-12">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>

      {/* ══ BANNER LISTA DE DESEJOS ═════════════════════════════════════════ */}
      <section className="border-t border-[#1A1A17] py-28" style={{ backgroundColor: "#0A0A09" }}>
        <div className="max-w-xl mx-auto px-6 text-center space-y-7">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-[#2A2A26]">
            <Heart className="w-4 h-4 text-[#5A5A52]" />
          </div>
          <h2
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
              fontWeight: 300,
              color: "#E8E3D8",
              lineHeight: 1.2,
            }}
          >
            Sua Lista de Desejos{" "}
            <span style={{ fontWeight: 700 }}>Personalizada</span>
          </h2>
          <p
            className="text-[13px] text-[#4A4A44] leading-relaxed max-w-xs mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.02em" }}
          >
            Não encontrou o que procura? Registre sua demanda e entraremos em contato quando disponível.
          </p>
          <Link href="/desejos">
            <button
              className="mt-2 px-8 py-3.5 bg-[#C8B99A] text-[#0F0F0E] hover:bg-[#D9CEBA] transition-colors inline-flex items-center gap-2.5"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.25em" }}
            >
              <Heart className="w-3.5 h-3.5" /> REGISTRAR DEMANDA
            </button>
          </Link>
        </div>
      </section>

      {/* ══ RODAPÉ ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1A1A17] py-10" style={{ backgroundColor: "#0A0A09" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <ShoopLogo variant="full" />
          <nav className="flex items-center gap-8">
            {[
              { label: "CATÁLOGO", action: () => setCat(null) },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="text-[7px] text-[#3A3A34] hover:text-[#7A7268] transition-colors"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.25em" }}
              >
                {label}
              </button>
            ))}
            <Link href="/desejos">
              <span
                className="text-[7px] text-[#3A3A34] hover:text-[#7A7268] cursor-pointer transition-colors"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.25em" }}
              >
                LISTA DE DESEJOS
              </span>
            </Link>
            <a
              href={`${PANEL}/login`}
              className="text-[7px] text-[#3A3A34] hover:text-[#7A7268] transition-colors"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.25em" }}
            >
              ENTRAR
            </a>
          </nav>
          <p
            className="text-[7px] text-[#2A2A28]"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300, letterSpacing: "0.12em" }}
          >
            © {new Date().getFullYear()} Permupay Vendas
          </p>
        </div>
      </footer>
    </div>
  );
}
