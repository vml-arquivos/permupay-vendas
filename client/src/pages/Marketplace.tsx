import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import logo from "@/assets/logo.png";

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
  cardInstallments?: number | null;
  boletoMonths?: number | null;
  salesChannel?: "SHOP" | "QUASE_ZERO" | "BOTH" | string | null;
  productCondition?: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias",
  OUTRO: "Outros",
};

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700&display=swap";
if (typeof document !== "undefined" && !document.getElementById("mkt-refatorado-fonts")) {
  const link = document.createElement("link");
  link.id = "mkt-refatorado-fonts";
  link.rel = "stylesheet";
  link.href = FONT_LINK;
  document.head.appendChild(link);
}
const SERIF = "'Montserrat', 'Poppins', sans-serif";
const SANS = "'Poppins', 'Montserrat', sans-serif";

const pixPrice = (p: CatalogProduct) =>
  (p.suggestedPricePix ?? 0) > 0
    ? p.suggestedPricePix
    : (p.suggestedPrice ?? 0) > 0
      ? p.suggestedPrice
      : null;

const cardPrice = (p: CatalogProduct) =>
  (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : null;

const hasStock = (p: CatalogProduct) => (p.stockQuantity ?? 0) > 0;

const isQuaseZero = (p: CatalogProduct) => {
  const channel = String(p.salesChannel ?? "SHOP").toUpperCase();
  return channel === "QUASE_ZERO" || channel === "BOTH";
};

const isShopProduct = (p: CatalogProduct) => {
  const channel = String(p.salesChannel ?? "SHOP").toUpperCase();
  return channel !== "QUASE_ZERO";
};

const normalize = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const FEATURED_NAMES = [
  "one million",
  "invictus",
  "la vie est belle",
  "sauvage",
  "alien",
  "boss bottled",
  "212 vip",
];

function pickHeroProducts(products: CatalogProduct[]) {
  const perfumes = products.filter(
    (p) => p.category === "PERFUME" && p.imageUrl && hasStock(p)
  );

  const ranked = [...perfumes].sort((a, b) => {
    const ai = FEATURED_NAMES.findIndex((name) => normalize(a.name).includes(name));
    const bi = FEATURED_NAMES.findIndex((name) => normalize(b.name).includes(name));
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return (b.suggestedPricePix ?? b.suggestedPrice ?? 0) - (a.suggestedPricePix ?? a.suggestedPrice ?? 0);
  });

  return ranked.slice(0, 4).length > 0 ? ranked.slice(0, 4) : perfumes.slice(0, 4);
}

function Logo({ size = 102 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt="Shoop PermuPay"
      style={{ height: size, width: "auto" }}
      className="object-contain"
    />
  );
}

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 rounded-sm bg-neutral-100" style={{ aspectRatio: "4/5" }} />
      <div className="space-y-2">
        <div className="h-2 w-16 rounded bg-neutral-100" />
        <div className="h-4 w-3/4 rounded bg-neutral-100" />
        <div className="h-4 w-1/2 rounded bg-neutral-100" />
      </div>
    </div>
  );
}

function ProductCard({ product: p }: { product: CatalogProduct }) {
  const stock = hasStock(p);
  const pix = pixPrice(p);
  const card = cardPrice(p);
  const inst = Math.max(1, Math.round(p.cardInstallments ?? 3));

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article className={`group cursor-pointer ${!stock ? "opacity-45" : ""}`} style={{ fontFamily: SANS }}>
        <div className="relative mb-4 overflow-hidden bg-white" style={{ aspectRatio: "4/5" }}>
          {p.promoTag && stock && (
            <span className="absolute left-2 top-2 z-10 bg-neutral-950 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-white">
              {p.promoTag}
            </span>
          )}

          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-neutral-200" />
            </div>
          )}

          {stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
              <div className="bg-neutral-950 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white">
                Ver peça
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[8px] font-medium uppercase tracking-[0.26em] text-neutral-400">
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>
          <h3
            className="line-clamp-2 text-sm text-neutral-900"
            style={{ fontFamily: SERIF, fontWeight: 700, lineHeight: 1.22, minHeight: "2.2rem" }}
          >
            {p.name}
          </h3>
          {pix ? (
            <div className="pt-1">
              <p className="text-lg font-bold tracking-[-0.04em] text-neutral-950">{fmt(pix)}</p>
              {card && inst > 1 && (
                <p className="text-[10px] font-semibold uppercase text-neutral-800">
                  ou {inst}x de {fmt(card / inst)}
                </p>
              )}
            </div>
          ) : (
            <p className="pt-1 text-xs italic text-neutral-400">
              Consulte o preço
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

function QuaseZeroCard({ product: p }: { product: CatalogProduct }) {
  const pix = pixPrice(p);
  return (
    <Link href={`/vitrine/${p.id}`}>
      <article className="group cursor-pointer rounded-[1.4rem] border border-amber-100 bg-white p-4 shadow-[0_12px_40px_rgba(120,53,15,0.06)]" style={{ fontFamily: SANS }}>
        <div className="mb-3 overflow-hidden rounded-[1rem] bg-stone-50" style={{ aspectRatio: "4/5" }}>
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-stone-200" />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-amber-700">Quase Zero</p>
          <h3 className="line-clamp-2 text-sm font-semibold text-stone-950" style={{ fontFamily: SERIF }}>{p.name}</h3>
          {pix && <p className="text-base font-bold text-stone-950">{fmt(pix)}</p>}
        </div>
      </article>
    </Link>
  );
}

export default function Marketplace() {
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";

  const shopProducts = useMemo(() => products.filter(isShopProduct), [products]);
  const almostZeroProducts = useMemo(() => products.filter(isQuaseZero), [products]);
  const heroProducts = useMemo(() => pickHeroProducts(shopProducts), [shopProducts]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (heroProducts.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroProducts.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [heroProducts.length]);

  useEffect(() => {
    if (activeSlide >= heroProducts.length) setActiveSlide(0);
  }, [heroProducts.length, activeSlide]);

  const categories = useMemo(
    () => Array.from(new Set(shopProducts.map((p) => p.category))),
    [shopProducts]
  );

  const featuredProducts = useMemo(() => {
    const base = category ? shopProducts.filter((p) => p.category === category) : shopProducts;
    return base.filter(hasStock);
  }, [shopProducts, category]);

  const activeHero = heroProducts[activeSlide] ?? null;
  const totalVisible = featuredProducts.length;

  const heroTitle = activeHero?.name ?? "Seleção premium";
  const heroPrice = activeHero && pixPrice(activeHero) ? fmt(pixPrice(activeHero)!) : null;
  const heroInstallments =
    activeHero && cardPrice(activeHero)
      ? Math.max(1, Math.round(activeHero.cardInstallments ?? 3))
      : 0;
  const heroInstallmentValue =
    activeHero && cardPrice(activeHero) && heroInstallments > 1
      ? fmt(cardPrice(activeHero)! / heroInstallments)
      : null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-8 px-6 lg:px-16">
          <Link href="/vitrine">
            <div className="cursor-pointer"><Logo size={112} /></div>
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            <button
              onClick={() => {
                setCategory(null);
                document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="border-b border-neutral-900 pb-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-900"
            >
              Catálogo
            </button>
            <Link href="/quase-zero">
              <span className="cursor-pointer text-xs font-medium uppercase tracking-[0.2em] text-amber-700 hover:text-neutral-900">
                Quase Zero
              </span>
            </Link>
            <Link href="/desejos">
              <span className="cursor-pointer text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-800">
                Lista de desejos
              </span>
            </Link>
            <a href={`${PANEL}/login`} className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-800">
              Gerenciar
            </a>
          </nav>

          <a
            href={`${PANEL}/login`}
            className="border border-neutral-900 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            Entrar
          </a>
        </div>
      </header>

      <section className="border-b border-neutral-100">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-16 lg:py-14">
          <div className="space-y-7">
            <div className="flex items-center gap-3">
              <div className="h-px w-10 bg-neutral-300" />
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-neutral-400">
                Catálogo perfumaria · Shoop PermuPay
              </span>
            </div>

            <div>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(2.5rem, 5vw, 4.2rem)",
                  fontWeight: 800,
                  color: "#111",
                  lineHeight: 1.02,
                  letterSpacing: "-0.05em",
                }}
              >
                A sua vitrine
                <br />
                <span style={{ color: "#b45309" }}>dos desejos</span>
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-500">
                Produtos selecionados, leitura mais limpa e vitrine separada entre catálogo principal e Quase Zero.
              </p>
            </div>

            <div className="grid max-w-sm grid-cols-2 gap-5">
              <div>
                <p className="text-2xl font-bold text-neutral-950">{shopProducts.length}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">Peças disponíveis</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">{almostZeroProducts.length}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">Quase Zero</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-neutral-950 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800"
              >
                Ver peças disponíveis
              </button>
              <a
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-neutral-200 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-800"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-neutral-100 bg-white shadow-[0_18px_80px_rgba(15,23,42,0.08)]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#faf7f2] via-white to-[#fbf8f3]" />
            <div className="relative grid min-h-[390px] gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
              <div className="flex flex-col justify-center">
                <span className="mb-3 inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-amber-800">
                  Curadoria em destaque
                </span>
                <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">
                  Perfumes selecionados
                </p>
                <h2
                  className="mt-3 max-w-md text-neutral-950"
                  style={{ fontFamily: SERIF, fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em" }}
                >
                  {heroTitle}
                </h2>
                {activeHero?.shortDescription && (
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-500">
                    {activeHero.shortDescription}
                  </p>
                )}
                <div className="mt-5 space-y-1">
                  {heroPrice && <p className="text-4xl font-black tracking-[-0.05em] text-neutral-950">{heroPrice}</p>}
                  {heroInstallmentValue && (
                    <p className="text-sm font-medium text-neutral-700">
                      ou {heroInstallments}x de {heroInstallmentValue}
                    </p>
                  )}
                </div>
                {activeHero && (
                  <Link href={`/vitrine/${activeHero.id}`}>
                    <button className="mt-6 inline-flex w-fit items-center gap-2 bg-neutral-950 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800">
                      Ver produto <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                )}
              </div>

              <div className="flex flex-col justify-center">
                <div className="relative mx-auto flex h-[260px] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-[1.6rem] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)] lg:h-[300px] lg:max-w-[320px]">
                  {activeHero?.imageUrl ? (
                    <img
                      src={activeHero.imageUrl}
                      alt={activeHero.name}
                      className="h-full w-full object-contain p-5"
                    />
                  ) : (
                    <ShoppingBag className="h-10 w-10 text-neutral-200" />
                  )}
                </div>

                {heroProducts.length > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSlide((prev) => (prev - 1 + heroProducts.length) % heroProducts.length)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                      aria-label="Slide anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      {heroProducts.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setActiveSlide(index)}
                          className={`h-2.5 rounded-full transition-all ${index === activeSlide ? "w-7 bg-rose-600" : "w-2.5 bg-neutral-300 hover:bg-neutral-400"}`}
                          aria-label={`Ir para slide ${index + 1}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSlide((prev) => (prev + 1) % heroProducts.length)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                      aria-label="Próximo slide"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-amber-900 py-3 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 lg:px-16">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em]">Quase Zero</p>
              <p className="text-xs text-amber-100">Usados, seminovos e peças únicas com preço especial</p>
            </div>
          </div>
          <Link href="/quase-zero">
            <span className="cursor-pointer text-sm text-white/90 hover:text-white">→</span>
          </Link>
        </div>
      </section>

      <section id="catalogo-shop" className="mx-auto max-w-7xl px-6 py-14 lg:px-16">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px w-6 bg-neutral-300" />
              <p className="text-[9px] font-medium uppercase tracking-[0.34em] text-neutral-400">Exponível agora</p>
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontWeight: 800, color: "#111", letterSpacing: "-0.03em" }}>
              Produtos em destaque
            </h2>
          </div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
            {totalVisible} {totalVisible === 1 ? "produto" : "produtos"}
          </p>
        </div>

        {categories.length > 1 && (
          <div className="mb-12 flex flex-wrap gap-3">
            {[{ key: null, label: "Todos" }, ...categories.map((c) => ({ key: c, label: CAT[c] || c }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCategory(key)}
                className={`px-4 py-2 text-[10px] font-medium uppercase tracking-[0.22em] transition-colors ${category === key ? "bg-neutral-950 text-white" : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-neutral-400">Nenhum produto encontrado nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {almostZeroProducts.length > 0 && (
        <section className="border-t border-neutral-100 bg-[#fcfaf7] py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-16">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px w-6 bg-amber-300" />
                  <p className="text-[9px] font-medium uppercase tracking-[0.34em] text-amber-700">Sessão separada</p>
                </div>
                <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em" }}>
                  Quase Zero
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                  Esta vitrine fica separada do catálogo principal. Aqui entram somente usados, seminovos, mostruário e peças únicas.
                </p>
              </div>
              <Link href="/quase-zero">
                <button className="inline-flex items-center gap-2 border border-amber-300 bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-800 transition-colors hover:bg-amber-50">
                  Abrir Quase Zero <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {almostZeroProducts.slice(0, 4).map((product) => (
                <QuaseZeroCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-neutral-100 py-24">
        <div className="mx-auto max-w-lg px-6 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white">
            <Heart className="h-4 w-4 text-neutral-400" />
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.5rem, 2.8vw, 2rem)", fontWeight: 800, color: "#111", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Sua Lista de Desejos<br />Personalizada
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-neutral-500">
            Registre o produto que deseja encontrar e nossa equipe entra em contato quando ele aparecer na vitrine.
          </p>
          <Link href="/desejos">
            <button className="mt-8 bg-neutral-950 px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800">
              Registrar demanda
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-100 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:flex-row lg:px-16">
          <Logo size={74} />
          <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            <button onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-neutral-800">
              Catálogo
            </button>
            <Link href="/quase-zero"><span className="cursor-pointer text-amber-700 hover:text-neutral-900">Quase Zero</span></Link>
            <Link href="/desejos"><span className="cursor-pointer hover:text-neutral-800">Lista de desejos</span></Link>
            <a href={`${PANEL}/login`} className="hover:text-neutral-800">Entrar</a>
          </nav>
          <p className="text-[10px] text-neutral-300">© {new Date().getFullYear()} Shoop PermuPay</p>
        </div>
      </footer>
    </div>
  );
}
