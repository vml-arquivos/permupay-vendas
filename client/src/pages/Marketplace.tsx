/**
 * Marketplace.tsx — Vitrine Pública "Silent Wealth"
 * Minimalista, sofisticado, premium.
 * Sem alteração de rotas, dados ou lógica de negócio.
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

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect width="34" height="34" rx="9" fill="#1c1917"/>
      <path d="M8 12.5C8 10.567 9.567 9 11.5 9H22.5C24.433 9 26 10.567 26 12.5C26 14.433 24.433 16 22.5 16H11.5C9.567 16 8 14.433 8 12.5Z" fill="#FAF9F6"/>
      <path d="M8 21.5C8 19.567 9.567 18 11.5 18H18.5C20.433 18 22 19.567 22 21.5C22 23.433 20.433 25 18.5 25H11.5C9.567 25 8 23.433 8 21.5Z" fill="#a8a29e"/>
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] bg-neutral-100 mb-4" />
      <div className="space-y-2 px-1">
        <div className="h-2 bg-neutral-100 rounded w-14" />
        <div className="h-3.5 bg-neutral-100 rounded w-4/5" />
        <div className="h-3 bg-neutral-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const low   = isLow(p);
  const pix   = pixPrice(p);
  const card  = cardPrice(p);
  const inst  = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article className={`group cursor-pointer ${!stock ? "opacity-50" : ""}`}>

        {/* Imagem flutuante */}
        <div className="relative overflow-hidden bg-[#F7F5F2] mb-4" style={{ aspectRatio: "4/5" }}>
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name}
              className="w-full h-full object-contain p-8 group-hover:scale-[1.04] transition-transform duration-700 ease-out" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-neutral-200" />
              <span className="text-[9px] text-neutral-300 mt-2 tracking-widest uppercase">Sem imagem</span>
            </div>
          )}

          {p.promoTag && stock && (
            <span className="absolute top-4 left-4 text-[9px] font-semibold tracking-[0.2em] uppercase text-neutral-500 bg-white/90 backdrop-blur-sm px-2.5 py-1">
              {p.promoTag}
            </span>
          )}
          {low && stock && (
            <span className="absolute top-4 right-4 text-[9px] font-medium text-amber-700 bg-amber-50/90 px-2.5 py-1">
              Últimas
            </span>
          )}
          {!stock && (
            <div className="absolute inset-0 flex items-end p-4">
              <span className="text-[9px] tracking-widest uppercase text-neutral-400 border-t border-neutral-200/60 pt-2 w-full">
                Indisponível
              </span>
            </div>
          )}
          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
              <div className="bg-neutral-900/95 backdrop-blur-sm py-3 text-white text-[10px] font-medium tracking-[0.18em] uppercase text-center flex items-center justify-center gap-1.5">
                Ver produto <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-0.5 space-y-1.5">
          <p className="text-[9px] font-semibold tracking-[0.28em] uppercase text-neutral-400">
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>
          <h3 className="text-sm font-medium text-neutral-800 leading-snug line-clamp-2 group-hover:text-neutral-500 transition-colors duration-300">
            {p.name}
          </h3>
          {p.shortDescription && (
            <p className="text-[11px] text-neutral-400 line-clamp-1">{p.shortDescription}</p>
          )}
          <div className="pt-1.5">
            {stock && pix ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-base font-semibold text-neutral-900">{fmt(pix)}</span>
                  <span className="text-[9px] font-bold tracking-wider text-emerald-600 uppercase">via pix</span>
                </div>
                {card && inst > 1 && (
                  <p className="text-[10px] text-neutral-400 mt-0.5">ou {inst}× {fmt(card / inst)} no cartão</p>
                )}
              </>
            ) : stock ? (
              <span className="text-xs text-neutral-400 italic">Consulte o preço</span>
            ) : (
              <Link href="/desejos">
                <button onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition-colors">
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

export default function Marketplace() {
  const [cat, setCat] = useState<string | null>(null);
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const cats = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const filtered = useMemo(() => cat ? products.filter((p) => p.category === cat) : products, [products, cat]);

  // Produto destaque para o hero
  const featured = products.find((p) => p.imageUrl && hasStock(p));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF9F6", fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-neutral-100 bg-[#FAF9F6]/92 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/vitrine">
            <div className="flex items-center gap-3 cursor-pointer group select-none">
              <Logo />
              <div className="leading-none">
                <span className="block text-[8px] font-medium text-neutral-400 tracking-[0.28em] uppercase">Shop</span>
                <span className="block text-[13px] font-black tracking-[0.2em] text-neutral-900 group-hover:text-neutral-600 transition-colors">PERMAPAY</span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            {[
              { label: "Catálogo", onClick: () => setCat(null), active: cat === null },
            ].map((item) => (
              <button key={item.label} onClick={item.onClick}
                className={`text-[10px] font-semibold tracking-[0.15em] uppercase pb-px border-b transition-colors ${item.active ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-700"}`}>
                {item.label}
              </button>
            ))}
            <Link href="/desejos">
              <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors pb-px border-b border-transparent">
                Lista de Desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`}
              className="text-[10px] font-semibold tracking-[0.15em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors pb-px border-b border-transparent">
              Gerenciar
            </a>
          </nav>

          <a href={`${PANEL}/login`}
            className="text-[10px] font-semibold tracking-[0.15em] uppercase px-5 py-2.5 border border-neutral-800 text-neutral-800 hover:bg-neutral-900 hover:text-white transition-all duration-300">
            Entrar
          </a>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="border-b border-neutral-100/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 grid lg:grid-cols-2 gap-20 items-center">

          {/* Copy */}
          <div className="space-y-8">
            <p className="text-[9px] font-semibold tracking-[0.35em] uppercase text-neutral-400">
              Catálogo Exclusivo · Shoop PermuPay
            </p>
            <h1 style={{ fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)", fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#1c1917", lineHeight: 1.06 }}>
              A sua vitrine<br />
              <em style={{ color: "#78350f", fontStyle: "italic" }}>dos desejos.</em>
            </h1>
            <p className="text-neutral-500 text-sm leading-relaxed max-w-xs">
              Produtos selecionados. Preços transparentes. Compra simples, segura e sofisticada.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
                className="px-8 py-3 bg-neutral-900 text-white text-[10px] font-semibold tracking-[0.18em] uppercase hover:bg-neutral-700 transition-colors">
                Explorar catálogo
              </button>
              <Link href="/desejos">
                <button className="px-8 py-3 border border-neutral-300 text-neutral-700 text-[10px] font-semibold tracking-[0.18em] uppercase hover:border-neutral-600 transition-colors">
                  Lista de desejos
                </button>
              </Link>
            </div>
          </div>

          {/* Visual hero */}
          <div className="hidden lg:flex items-center justify-center relative min-h-[360px]">
            <div className="absolute w-80 h-80 rounded-full border border-neutral-100" />
            <div className="absolute w-60 h-60 rounded-full border border-neutral-100/60" />
            {featured ? (
              <Link href={`/vitrine/${featured.id}`}>
                <div className="relative z-10 cursor-pointer group">
                  <img src={featured.imageUrl!} alt={featured.name}
                    className="w-60 h-60 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-700" />
                  {/* Float card */}
                  <div className="absolute -bottom-6 -right-8 bg-white shadow-xl p-4 min-w-[160px] z-20">
                    <p className="text-[8px] tracking-[0.22em] uppercase text-neutral-400 mb-1 line-clamp-1">
                      {featured.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    <p className="text-base font-semibold text-neutral-900">
                      {pixPrice(featured) ? fmt(pixPrice(featured)!) : "—"}
                    </p>
                    {pixPrice(featured) && (
                      <p className="text-[9px] text-emerald-600 font-semibold tracking-wide mt-0.5 uppercase">via pix</p>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative z-10 w-60 h-60 flex items-center justify-center">
                <ShoppingBag className="w-14 h-14 text-neutral-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FILTROS ═════════════════════════════════════════════════════════ */}
      {cats.length > 1 && (
        <div className="border-b border-neutral-100 bg-[#FAF9F6]">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 h-11 flex items-center gap-10 overflow-x-auto no-scrollbar">
            <button onClick={() => setCat(null)}
              className={`shrink-0 text-[9px] font-semibold tracking-[0.25em] uppercase pb-px border-b transition-all ${!cat ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-600"}`}>
              Todos
            </button>
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`shrink-0 text-[9px] font-semibold tracking-[0.25em] uppercase pb-px border-b transition-all ${cat === c ? "text-neutral-900 border-neutral-900" : "text-neutral-400 border-transparent hover:text-neutral-600"}`}>
                {CAT[c] || c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ PRODUTOS ════════════════════════════════════════════════════════ */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-16">
        <div className="flex items-end justify-between mb-14">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.32em] uppercase text-neutral-400 mb-3">Coleção em destaque</p>
            <h2 style={{ fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 700, color: "#1c1917", lineHeight: 1.1 }}>
              Vitrine dos{" "}
              <em style={{ color: "#92400e", fontStyle: "italic" }}>Desejos</em>
            </h2>
          </div>
          {!isLoading && filtered.length > 0 && (
            <p className="text-[10px] text-neutral-400 tracking-wide shrink-0">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 sm:gap-12">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 space-y-4">
            <p className="text-[10px] tracking-[0.35em] uppercase text-neutral-300">Em breve</p>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)", fontSize: "1.8rem", fontWeight: 600, color: "#78716c" }}>
              Vitrine em preparação
            </h3>
            <p className="text-sm text-neutral-400">Novos produtos chegando.</p>
            <Link href="/desejos">
              <button className="mt-4 text-[10px] tracking-[0.18em] uppercase border border-neutral-300 text-neutral-500 px-6 py-2.5 hover:border-neutral-500 transition-colors inline-flex items-center gap-2">
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

      {/* ══ BANNER LISTA DE DESEJOS ═════════════════════════════════════════ */}
      <section className="border-t border-neutral-100 py-24" style={{ backgroundColor: "#F2EFE9" }}>
        <div className="max-w-xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-neutral-200 bg-white">
            <Heart className="w-5 h-5 text-neutral-400" />
          </div>
          <h2 style={{ fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)", fontSize: "clamp(1.3rem, 3vw, 1.9rem)", fontWeight: 600, color: "#1c1917", lineHeight: 1.2 }}>
            Sua Lista de Desejos Personalizada
          </h2>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-xs mx-auto">
            Não encontrou o que procura? Registre sua demanda e entraremos em contato quando disponível.
          </p>
          <Link href="/desejos">
            <button className="mt-2 px-8 py-3.5 bg-neutral-900 text-white text-[10px] font-semibold tracking-[0.18em] uppercase hover:bg-neutral-700 transition-colors inline-flex items-center gap-2.5">
              <Heart className="w-3.5 h-3.5" /> Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ══ RODAPÉ ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-100 py-10 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={22} />
            <span className="text-[11px] font-black tracking-[0.22em] text-neutral-500">PERMAPAY</span>
          </div>
          <nav className="flex items-center gap-8">
            <button onClick={() => setCat(null)} className="text-[9px] tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">Catálogo</button>
            <Link href="/desejos"><span className="text-[9px] tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors">Lista de Desejos</span></Link>
            <a href={`${PANEL}/login`} className="text-[9px] tracking-[0.18em] uppercase text-neutral-400 hover:text-neutral-700 transition-colors">Entrar</a>
          </nav>
          <p className="text-[9px] text-neutral-300 tracking-wide">© {new Date().getFullYear()} Permupay Vendas</p>
        </div>
      </footer>
    </div>
  );
}
