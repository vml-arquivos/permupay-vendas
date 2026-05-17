/**
 * Marketplace.tsx — Vitrine Pública "Silent Wealth" · Shoop Permupay
 * Refatorado: identidade visual premium, paleta grafite/alabastro, tipografia editorial.
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

/* ── Logo SVG Shoop Permupay ──────────────────────────────────────────────── */
function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect width="34" height="34" rx="7" fill="#0F0F0E"/>
      <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5Z" fill="#E8E3D8"/>
      <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5Z" fill="#7A7268"/>
    </svg>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] bg-[#1E1E1B] mb-4 rounded-sm" />
      <div className="space-y-2 px-1">
        <div className="h-2 bg-[#2A2A26] rounded w-14" />
        <div className="h-3.5 bg-[#2A2A26] rounded w-4/5" />
        <div className="h-3 bg-[#2A2A26] rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

/* ── Product Card ─────────────────────────────────────────────────────────── */
function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const low   = isLow(p);
  const pix   = pixPrice(p);
  const card  = cardPrice(p);
  const inst  = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article className={`group cursor-pointer ${!stock ? "opacity-40" : ""}`}>

        {/* Container da imagem — produto "flutuando" com mix-blend */}
        <div
          className="relative overflow-hidden mb-5"
          style={{ aspectRatio: "4/5", background: "linear-gradient(160deg, #1A1A17 0%, #141411 100%)" }}
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
              <span className="text-[8px] text-[#3A3A34] tracking-[0.3em] uppercase">Sem imagem</span>
            </div>
          )}

          {/* Badge promoção */}
          {p.promoTag && stock && (
            <span className="absolute top-3.5 left-3.5 text-[8px] font-bold tracking-[0.22em] uppercase text-[#C8B99A] border border-[#C8B99A]/30 bg-[#0F0F0E]/80 backdrop-blur-sm px-2.5 py-1">
              {p.promoTag}
            </span>
          )}

          {/* Badge últimas unidades */}
          {low && stock && (
            <span className="absolute top-3.5 right-3.5 text-[8px] font-medium text-amber-300/80 border border-amber-500/20 bg-amber-950/60 px-2 py-0.5">
              Últimas
            </span>
          )}

          {/* Overlay indisponível */}
          {!stock && (
            <div className="absolute inset-0 flex items-end p-4 bg-[#0F0F0E]/40">
              <span className="text-[8px] tracking-[0.3em] uppercase text-[#5A5A52] border-t border-[#3A3A34]/50 pt-2 w-full">
                Indisponível
              </span>
            </div>
          )}

          {/* CTA deslizante no hover */}
          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
              <div className="bg-[#C8B99A] py-3 text-[#0F0F0E] text-[9px] font-bold tracking-[0.22em] uppercase text-center flex items-center justify-center gap-1.5">
                Ver produto <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>

        {/* Info textual */}
        <div className="px-0.5 space-y-2">
          <p className="text-[8px] font-semibold tracking-[0.3em] uppercase text-[#5A5A52]">
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>
          <h3 className="text-sm font-light text-[#E8E3D8] leading-snug line-clamp-2 tracking-wide group-hover:text-[#C8B99A] transition-colors duration-300">
            {p.name}
          </h3>
          {p.shortDescription && (
            <p className="text-[10px] text-[#5A5A52] line-clamp-1 font-light tracking-wide">{p.shortDescription}</p>
          )}

          <div className="pt-1">
            {stock && pix ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="text-base font-semibold text-[#E8E3D8] tracking-tight"
                    style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', 'Playfair Display', Georgia, serif)" }}
                  >
                    {fmt(pix)}
                  </span>
                  <span className="text-[8px] font-bold tracking-[0.18em] text-[#7EC89A] uppercase">via pix</span>
                </div>
                {card && inst > 1 && (
                  <p className="text-[9px] text-[#4A4A44] mt-0.5 font-light">
                    ou {inst}× {fmt(card / inst)} no cartão
                  </p>
                )}
              </>
            ) : stock ? (
              <span className="text-xs text-[#4A4A44] italic font-light">Consulte o preço</span>
            ) : (
              <Link href="/desejos">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] text-[#5A5A52] hover:text-[#C8B99A] flex items-center gap-1 transition-colors font-light tracking-wide"
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

/* ── Marketplace Principal ────────────────────────────────────────────────── */
export default function Marketplace() {
  const [cat, setCat] = useState<string | null>(null);
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const cats     = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const filtered = useMemo(() => cat ? products.filter((p) => p.category === cat) : products, [products, cat]);
  const featured = useMemo(() => products.find((p) => hasStock(p) && p.imageUrl), [products]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#111110", color: "#E8E3D8" }}>

      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-[#222220] bg-[#111110]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/vitrine">
            <div className="flex items-center gap-3 cursor-pointer select-none group">
              <Logo size={26} />
              <div className="leading-none">
                <span className="block text-[7px] text-[#5A5A52] tracking-[0.35em] uppercase font-medium">Shop</span>
                <span className="block text-[11px] font-black tracking-[0.22em] text-[#E8E3D8] group-hover:text-[#C8B99A] transition-colors">PERMAPAY</span>
              </div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-10">
            <button
              onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
              className="text-[9px] font-semibold tracking-[0.25em] uppercase text-[#5A5A52] hover:text-[#E8E3D8] border-b border-transparent hover:border-[#C8B99A]/40 pb-px transition-all"
            >
              Catálogo
            </button>
            <Link href="/desejos">
              <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-[#5A5A52] hover:text-[#E8E3D8] border-b border-transparent hover:border-[#C8B99A]/40 pb-px transition-all cursor-pointer">
                Lista de Desejos
              </span>
            </Link>
            <a
              href={`${PANEL}/login`}
              className="text-[9px] font-bold tracking-[0.2em] uppercase px-4 py-2 border border-[#2E2E2A] text-[#7A7268] hover:border-[#C8B99A]/50 hover:text-[#C8B99A] transition-all"
            >
              Entrar
            </a>
          </nav>
        </div>
      </header>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="border-b border-[#1A1A17]" style={{ backgroundColor: "#0F0F0E" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Copy */}
          <div className="space-y-8">
            <p className="text-[8px] font-semibold tracking-[0.4em] uppercase text-[#5A5A52]">
              Catálogo Exclusivo · Shoop PermuPay
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif, 'Cormorant Garamond', 'Playfair Display', Georgia, serif)",
                fontSize: "clamp(2.6rem, 5vw, 4.2rem)",
                fontWeight: 600,
                color: "#E8E3D8",
                lineHeight: 1.04,
                letterSpacing: "-0.01em",
              }}
            >
              A sua vitrine<br />
              <em style={{ color: "#C8B99A", fontStyle: "italic" }}>dos desejos.</em>
            </h1>
            <p className="text-[#5A5A52] text-sm leading-relaxed max-w-xs font-light tracking-wide">
              Produtos selecionados. Preços transparentes.<br />Compra simples, segura e sofisticada.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3 bg-[#C8B99A] text-[#0F0F0E] text-[9px] font-bold tracking-[0.22em] uppercase hover:bg-[#E8E3D8] transition-colors"
              >
                Explorar catálogo
              </button>
              <Link href="/desejos">
                <button className="px-8 py-3 border border-[#2E2E2A] text-[#7A7268] text-[9px] font-semibold tracking-[0.22em] uppercase hover:border-[#C8B99A]/40 hover:text-[#C8B99A] transition-all">
                  Lista de desejos
                </button>
              </Link>
            </div>
          </div>

          {/* Hero visual — produto flutuante */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[380px]">
            {/* Anéis decorativos */}
            <div className="absolute w-72 h-72 rounded-full border border-[#2A2A26]/60" />
            <div className="absolute w-52 h-52 rounded-full border border-[#C8B99A]/8" />
            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="relative z-10 cursor-pointer group">
                  <img
                    src={featured.imageUrl!}
                    alt={featured.name}
                    className="w-56 h-56 object-contain drop-shadow-2xl mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-105 transition-all duration-700"
                  />
                  {/* Float card */}
                  <div className="absolute -bottom-4 -right-10 bg-[#1A1A17] border border-[#2E2E2A] p-4 min-w-[168px] z-20 shadow-2xl">
                    <p className="text-[7px] tracking-[0.28em] uppercase text-[#5A5A52] mb-1.5 line-clamp-1">
                      {featured.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p
                      className="text-base font-semibold text-[#E8E3D8]"
                      style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)" }}
                    >
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "—"}
                    </p>
                    {pixPrice(featured) && (
                      <p className="text-[8px] text-[#7EC89A] font-bold tracking-wider mt-1 uppercase">via pix</p>
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

      {/* ══ FILTROS ═══════════════════════════════════════════════════════════ */}
      {cats.length > 1 && (
        <div className="border-b border-[#1A1A17]" style={{ backgroundColor: "#0F0F0E" }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-12 h-11 flex items-center gap-10 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCat(null)}
              className={`shrink-0 text-[8px] font-bold tracking-[0.28em] uppercase pb-px border-b transition-all ${
                !cat ? "text-[#C8B99A] border-[#C8B99A]" : "text-[#4A4A44] border-transparent hover:text-[#7A7268]"
              }`}
            >
              Todos
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 text-[8px] font-bold tracking-[0.28em] uppercase pb-px border-b transition-all ${
                  cat === c ? "text-[#C8B99A] border-[#C8B99A]" : "text-[#4A4A44] border-transparent hover:text-[#7A7268]"
                }`}
              >
                {CAT[c] || c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ PRODUTOS ══════════════════════════════════════════════════════════ */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-16">
          <div>
            <p className="text-[8px] font-semibold tracking-[0.35em] uppercase text-[#4A4A44] mb-3">Coleção em destaque</p>
            <h2
              style={{
                fontFamily: "var(--font-serif, 'Cormorant Garamond', 'Playfair Display', Georgia, serif)",
                fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                fontWeight: 600,
                color: "#E8E3D8",
                lineHeight: 1.08,
              }}
            >
              Vitrine dos{" "}
              <em style={{ color: "#C8B99A", fontStyle: "italic" }}>Desejos</em>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p className="text-[9px] text-[#4A4A44] tracking-wide shrink-0 font-light">
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
            <p className="text-[9px] tracking-[0.38em] uppercase text-[#3A3A34]">Em breve</p>
            <h3
              style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: "2rem", fontWeight: 500, color: "#5A5A52" }}
            >
              Vitrine em preparação
            </h3>
            <p className="text-sm text-[#3A3A34] font-light tracking-wide">Novos produtos chegando em breve.</p>
            <Link href="/desejos">
              <button className="mt-4 text-[9px] tracking-[0.22em] uppercase border border-[#2E2E2A] text-[#5A5A52] px-7 py-3 hover:border-[#C8B99A]/40 hover:text-[#C8B99A] transition-all inline-flex items-center gap-2">
                <Heart className="w-3.5 h-3.5" /> Registrar desejo
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-12">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>

      {/* ══ BANNER LISTA DE DESEJOS ═══════════════════════════════════════════ */}
      <section className="border-t border-[#1A1A17] py-28" style={{ backgroundColor: "#0D0D0C" }}>
        <div className="max-w-xl mx-auto px-6 text-center space-y-7">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-[#2A2A26]">
            <Heart className="w-4 h-4 text-[#5A5A52]" />
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif, 'Cormorant Garamond', 'Playfair Display', Georgia, serif)",
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              fontWeight: 500,
              color: "#E8E3D8",
              lineHeight: 1.2,
            }}
          >
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-sm text-[#4A4A44] leading-relaxed max-w-xs mx-auto font-light tracking-wide">
            Não encontrou o que procura? Registre sua demanda e entraremos em contato quando disponível.
          </p>
          <Link href="/desejos">
            <button className="mt-2 px-8 py-3.5 bg-[#C8B99A] text-[#0F0F0E] text-[9px] font-bold tracking-[0.22em] uppercase hover:bg-[#E8E3D8] transition-colors inline-flex items-center gap-2.5">
              <Heart className="w-3.5 h-3.5" /> Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ══ RODAPÉ ════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1A1A17] py-10" style={{ backgroundColor: "#0F0F0E" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <span className="text-[10px] font-black tracking-[0.25em] text-[#3A3A34] uppercase">PERMAPAY</span>
          </div>
          <nav className="flex items-center gap-8">
            <button onClick={() => setCat(null)} className="text-[8px] tracking-[0.2em] uppercase text-[#3A3A34] hover:text-[#7A7268] transition-colors">Catálogo</button>
            <Link href="/desejos"><span className="text-[8px] tracking-[0.2em] uppercase text-[#3A3A34] hover:text-[#7A7268] cursor-pointer transition-colors">Lista de Desejos</span></Link>
            <a href={`${PANEL}/login`} className="text-[8px] tracking-[0.2em] uppercase text-[#3A3A34] hover:text-[#7A7268] transition-colors">Entrar</a>
          </nav>
          <p className="text-[8px] text-[#2E2E2A] tracking-wide">© {new Date().getFullYear()} Permupay Vendas</p>
        </div>
      </footer>
    </div>
  );
}
