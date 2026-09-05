import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { captureReferralFromLocation } from "@/lib/referral";
import { useCart } from "@/contexts/CartContext";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
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
  featuredInHero?: boolean;
  displayOrder?: number;
}

const CAT: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias",
  OUTRO: "Outros",
};

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700&display=swap";

if (typeof document !== "undefined" && !document.getElementById("mkt-static-premium-fonts")) {
  const link = document.createElement("link");
  link.id = "mkt-static-premium-fonts";
  link.rel = "stylesheet";
  link.href = FONT_LINK;
  document.head.appendChild(link);
}

const SERIF = "'Montserrat', 'Poppins', sans-serif";
const SANS = "'Poppins', 'Montserrat', sans-serif";

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pixPrice = (product: CatalogProduct) =>
  (product.suggestedPricePix ?? 0) > 0
    ? product.suggestedPricePix
    : (product.suggestedPrice ?? 0) > 0
      ? product.suggestedPrice
      : null;

const cardPrice = (product: CatalogProduct) =>
  (product.suggestedPriceCard ?? 0) > 0 ? product.suggestedPriceCard : null;

const hasStock = (product: CatalogProduct) => (product.stockQuantity ?? 0) > 0;

const isQuaseZeroProduct = (product: CatalogProduct) => {
  const channel = String(product.salesChannel ?? "SHOP").toUpperCase();
  return channel === "QUASE_ZERO" || channel === "BOTH";
};

const isShopProduct = (product: CatalogProduct) => {
  const channel = String(product.salesChannel ?? "SHOP").toUpperCase();
  return channel !== "QUASE_ZERO";
};

// Cor de destaque do preço — mesma família do dourado/âmbar já usado na
// marca ("dos desejos", Quase Zero), só um tom mais profundo para dar
// hierarquia ao valor sem introduzir uma cor nova ao sistema.
const PRICE_ACCENT = "#92400e";

/**
 * Bloco de preço compartilhado entre o grid de produtos e o carrossel
 * principal — destaque sutil (cor + microrrótulo "no pix"), nunca um selo
 * ou faixa berrante. `size="lg"` é usado só no banner principal.
 */
function PriceTag({ product, size = "md" }: { product: CatalogProduct; size?: "md" | "lg" }) {
  const pix = pixPrice(product);
  const card = cardPrice(product);
  const installments = Math.max(1, Math.round(product.cardInstallments ?? 3));

  if (!pix) {
    return <p className="pt-1 text-xs italic text-neutral-400">Consulte o preço</p>;
  }

  const priceClass = size === "lg" ? "text-3xl sm:text-[2.5rem]" : "text-lg";

  return (
    <div className="pt-1">
      <div className="flex items-baseline gap-2">
        <p
          className={`${priceClass} font-extrabold leading-none tracking-[-0.03em]`}
          style={{ color: PRICE_ACCENT }}
        >
          {fmt(pix)}
        </p>
        <span className="text-[8px] font-semibold uppercase tracking-[0.22em] text-amber-700/60">
          no pix
        </span>
      </div>
      {card && installments > 1 && (
        <p className={`mt-1 font-semibold uppercase text-neutral-500 ${size === "lg" ? "text-xs tracking-wide" : "text-[10px] tracking-wide"}`}>
          ou {installments}x de {fmt(card / installments)}
        </p>
      )}
    </div>
  );
}

function Logo({ size = 92 }: { size?: number }) {
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
      <div className="mb-4 bg-neutral-100" style={{ aspectRatio: "4/5" }} />
      <div className="space-y-2">
        <div className="h-2 w-16 rounded bg-neutral-100" />
        <div className="h-4 w-3/4 rounded bg-neutral-100" />
        <div className="h-4 w-1/2 rounded bg-neutral-100" />
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const stock = hasStock(product);

  return (
    <Link href={`/vitrine/${product.id}`}>
      <article
        className={`group cursor-pointer ${!stock ? "opacity-45" : ""}`}
        style={{ fontFamily: SANS }}
      >
        <div className="relative mb-4 overflow-hidden bg-white" style={{ aspectRatio: "4/5" }}>
          {product.promoTag && stock && (
            <span className="absolute left-2 top-2 z-10 bg-neutral-950 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-white">
              {product.promoTag}
            </span>
          )}

          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
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

          {!stock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75">
              <span className="border border-neutral-200 bg-white px-3 py-1 text-[9px] uppercase tracking-[0.22em] text-neutral-400">
                Indisponível
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[8px] font-medium uppercase tracking-[0.26em] text-neutral-400">
            {product.categoryLabel || CAT[product.category] || product.category}
          </p>
          <h3
            className="line-clamp-2 text-sm text-neutral-900"
            style={{ fontFamily: SERIF, fontWeight: 700, lineHeight: 1.22, minHeight: "2.2rem" }}
          >
            {product.name}
          </h3>
          <PriceTag product={product} />
        </div>
      </article>
    </Link>
  );
}

function QuaseZeroCard({ product }: { product: CatalogProduct }) {
  return (
    <Link href={`/vitrine/${product.id}`}>
      <article
        className="group cursor-pointer rounded-[1.25rem] border border-amber-100 bg-white p-3 shadow-[0_12px_34px_rgba(120,53,15,0.05)] transition-transform hover:-translate-y-0.5"
        style={{ fontFamily: SANS }}
      >
        <div className="mb-3 overflow-hidden rounded-[1rem] bg-stone-50" style={{ aspectRatio: "4/5" }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-stone-200" />
            </div>
          )}
        </div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-amber-700">
          Quase Zero
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-stone-950" style={{ fontFamily: SERIF }}>
          {product.name}
        </h3>
        <PriceTag product={product} />
      </article>
    </Link>
  );
}

export default function Marketplace() {
  const { data, isLoading } = trpc.marketplace.products.useQuery();
  const products = (data ?? []) as CatalogProduct[];
  const PANEL = import.meta.env.VITE_PANEL_URL ?? "";
  const cart = useCart();

  const [activeSlide, setActiveSlide] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const shopProducts = useMemo(() => products.filter(isShopProduct), [products]);
  const quaseZeroProducts = useMemo(() => products.filter(isQuaseZeroProduct), [products]);

  // Carrossel principal: nunca uma imagem estática. Usa a curadoria manual
  // do admin ("Destacar no carrossel", ver ProductForm) quando existir; sem
  // nenhum produto marcado, monta automaticamente a partir do próprio
  // catálogo em estoque — peças com selo promocional primeiro, depois as de
  // maior valor — garantindo que o produto e o preço mostrados são sempre
  // reais e batem com o estoque atual.
  const heroProducts = useMemo(() => {
    const eligible = shopProducts.filter((product) => hasStock(product) && pixPrice(product) != null);
    if (eligible.length === 0) return [];

    const curated = eligible
      .filter((product) => product.featuredInHero)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id);

    if (curated.length > 0) return curated.slice(0, 6);

    const byPriceDesc = (a: CatalogProduct, b: CatalogProduct) => (pixPrice(b) ?? 0) - (pixPrice(a) ?? 0);
    const withTag = eligible.filter((product) => product.promoTag).sort(byPriceDesc);
    const withoutTag = eligible.filter((product) => !product.promoTag).sort(byPriceDesc);

    return [...withTag, ...withoutTag].slice(0, 5);
  }, [shopProducts]);

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  // Mantém o slide ativo dentro dos limites quando a lista de destaques
  // muda de tamanho (ex.: um produto sai de estoque).
  useEffect(() => {
    setActiveSlide((current) => (heroProducts.length === 0 ? 0 : current % heroProducts.length));
  }, [heroProducts.length]);

  useEffect(() => {
    if (heroProducts.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroProducts.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [heroProducts.length]);

  const categories = useMemo(
    () => Array.from(new Set(shopProducts.map((product) => product.category))),
    [shopProducts]
  );

  const filteredShopProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return shopProducts.filter((product) => {
      const byCategory = category ? product.category === category : true;
      const bySearch = normalizedSearch
        ? `${product.name} ${product.shortDescription ?? ""} ${product.categoryLabel ?? ""}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return byCategory && bySearch && hasStock(product);
    });
  }, [shopProducts, category, search]);

  const currentBanner = heroProducts[activeSlide] ?? null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>
      <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-8 px-6 lg:px-16">
          <Link href="/vitrine">
            <div className="cursor-pointer">
              <Logo size={94} />
            </div>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            <button
              onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
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

          <div className="flex items-center gap-4">
            <Link href="/minha-conta">
              <button
                className="flex items-center gap-1.5 text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Minha conta"
                title="Minha conta"
              >
                <UserRound className="h-[18px] w-[18px]" />
                <span className="hidden text-xs font-medium uppercase tracking-[0.2em] lg:inline">
                  Minha conta
                </span>
              </button>
            </Link>
            <Link href="/minha-conta">
              <button
                className="relative flex items-center text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Meu carrinho"
                title="Meu carrinho"
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cart.itemCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[9px] font-bold text-white">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </Link>
            <a
              href={`${PANEL}/login`}
              className="border border-neutral-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
            >
              Entrar
            </a>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-100 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-10 lg:grid-cols-[0.74fr_1.26fr] lg:px-16 lg:py-12">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-px w-10 bg-neutral-300" />
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-neutral-400">
                Catálogo · Shoop PermuPay
              </span>
            </div>

            <h1
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(2.15rem, 4vw, 3.15rem)",
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

            <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
              Produtos selecionados, preço transparente e leitura separada entre Shop e Quase Zero.
            </p>

            <div className="grid max-w-sm grid-cols-2 gap-5 pt-1">
              <div>
                <p className="text-2xl font-bold text-neutral-950">{shopProducts.length}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">Peças Shop</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">{quaseZeroProducts.length}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] text-neutral-400">Quase Zero</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-neutral-900 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-950 hover:text-white"
              >
                Ver peças
              </button>
              <Link href="/quase-zero">
                <button className="border border-amber-300 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-800 transition-colors hover:bg-amber-50">
                  Quase Zero
                </button>
              </Link>
            </div>
          </div>

          <div>
            <div className="relative overflow-hidden rounded-[1.5rem] border border-neutral-100 bg-[#fbfaf7] shadow-[0_16px_70px_rgba(15,23,42,0.07)]">
              {currentBanner ? (
                <Link href={`/vitrine/${currentBanner.id}`}>
                  <div className="flex cursor-pointer flex-col sm:flex-row sm:items-stretch">
                    <div className="order-2 flex flex-1 flex-col justify-center gap-3 px-7 py-7 sm:order-1 sm:px-10 sm:py-8">
                      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.24em] text-amber-800">
                        <Sparkles className="h-3 w-3" />
                        {currentBanner.promoTag || "Peça em destaque"}
                      </span>
                      <h3
                        className="line-clamp-2 text-xl font-extrabold text-neutral-900 sm:text-[1.75rem]"
                        style={{ fontFamily: SERIF, letterSpacing: "-0.03em", lineHeight: 1.1 }}
                      >
                        {currentBanner.name}
                      </h3>
                      <PriceTag product={currentBanner} size="lg" />
                      <span className="mt-1 inline-flex w-fit items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-900">
                        Ver peça <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="order-1 h-52 overflow-hidden bg-white sm:order-2 sm:h-auto sm:w-[40%]">
                      {currentBanner.imageUrl ? (
                        <img
                          src={currentBanner.imageUrl}
                          alt={currentBanner.name}
                          className="h-full w-full object-contain p-6"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-10 w-10 text-neutral-200" />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center justify-center px-8 py-20 text-center">
                  <p className="text-sm text-neutral-400">Em breve, novidades selecionadas do estoque.</p>
                </div>
              )}
            </div>

            {heroProducts.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSlide((current) => (current - 1 + heroProducts.length) % heroProducts.length)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Peça anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {heroProducts.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === activeSlide ? "w-6 bg-amber-700" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                    aria-label={`Abrir peça ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setActiveSlide((current) => (current + 1) % heroProducts.length)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Próxima peça"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-amber-900 py-3 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 lg:px-16">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em]">Quase Zero</p>
              <p className="text-xs text-amber-100">Usados, seminovos e peças únicas em vitrine separada</p>
            </div>
          </div>
          <Link href="/quase-zero">
            <span className="cursor-pointer text-sm text-white/90 hover:text-white">→</span>
          </Link>
        </div>
      </section>

      <main id="catalogo-shop" className="mx-auto max-w-7xl px-6 py-12 lg:px-16">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px w-6 bg-neutral-300" />
              <p className="text-[9px] font-medium uppercase tracking-[0.34em] text-neutral-400">
                Shop PermuPay
              </p>
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.7rem, 2.7vw, 2.25rem)", fontWeight: 800, color: "#111", letterSpacing: "-0.03em" }}>
              Produtos em destaque
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto..."
                className="h-10 w-full border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-neutral-500 sm:w-64"
              />
            </div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              {filteredShopProducts.length} produtos
            </p>
          </div>
        </div>

        {categories.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2">
            {[{ key: null, label: "Todos" }, ...categories.map((categoryName) => ({ key: categoryName, label: CAT[categoryName] || categoryName }))].map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setCategory(key)}
                className={`px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
                  category === key
                    ? "bg-neutral-950 text-white"
                    : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        ) : filteredShopProducts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-neutral-400">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredShopProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {quaseZeroProducts.length > 0 && (
        <section className="border-t border-neutral-100 bg-[#fcfaf7] py-12">
          <div className="mx-auto max-w-7xl px-6 lg:px-16">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px w-6 bg-amber-300" />
                  <p className="text-[9px] font-medium uppercase tracking-[0.34em] text-amber-700">
                    Separado do catálogo principal
                  </p>
                </div>
                <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.7rem, 2.7vw, 2.25rem)", fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em" }}>
                  Quase Zero
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                  Peças usadas, seminovas, mostruário e itens únicos ficam em uma vitrine própria.
                </p>
              </div>
              <Link href="/quase-zero">
                <button className="inline-flex items-center gap-2 border border-amber-300 bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-800 transition-colors hover:bg-amber-50">
                  Abrir Quase Zero <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {quaseZeroProducts.slice(0, 4).map((product) => (
                <QuaseZeroCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-neutral-100 py-20">
        <div className="mx-auto max-w-lg px-6 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white">
            <Heart className="h-4 w-4 text-neutral-400" />
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.45rem, 2.6vw, 1.9rem)", fontWeight: 800, color: "#111", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Sua lista de desejos personalizada
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-neutral-500">
            Registre o produto que deseja encontrar e nossa equipe entra em contato quando ele aparecer na vitrine.
          </p>
          <Link href="/desejos">
            <button className="mt-8 border border-neutral-900 px-8 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-950 hover:text-white">
              Registrar demanda
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-100 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:flex-row lg:px-16">
          <Logo size={74} />
          <nav className="flex flex-wrap items-center justify-center gap-7 text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            <button onClick={() => document.getElementById("catalogo-shop")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-neutral-800">
              Catálogo
            </button>
            <Link href="/quase-zero">
              <span className="cursor-pointer text-amber-700 hover:text-neutral-900">Quase Zero</span>
            </Link>
            <Link href="/desejos">
              <span className="cursor-pointer hover:text-neutral-800">Lista de desejos</span>
            </Link>
            <a href={`${PANEL}/login`} className="hover:text-neutral-800">Entrar</a>
          </nav>
          <p className="text-[10px] text-neutral-300">© {new Date().getFullYear()} Shoop PermuPay</p>
        </div>
      </footer>
    </div>
  );
}
