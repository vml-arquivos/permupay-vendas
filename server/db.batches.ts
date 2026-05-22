/**
 * ProductPage.tsx — Página pública do produto
 *
 * Correção desta fase:
 * - Galeria pública com imagem principal + miniaturas.
 * - Compatibilidade com produto antigo que usa apenas imageUrl.
 * - Pagamento em dinheiro exibido sem inventar taxa.
 * - Uma ação principal: Reservar produto.
 * - Formas de pagamento apenas descritivas, sem CTAs individuais.
 * - Checkout preservado via BuyModal.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  MessageCircle,
  Heart,
  Share2,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { BuyModal } from "@/components/BuyModal";
import logo from "@/assets/logo.png";


interface NormalizedImage {
  id: string;
  url: string;
  alt: string;
  isThumbnail?: boolean;
  sortOrder?: number;
}

const fmt = (v: number | null | undefined): string => {
  if (v == null || v === 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const CATEGORY_META: Record<string, string> = {
  CELULAR: "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias",
  OUTRO: "Outros",
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap";
if (typeof document !== "undefined" && !document.getElementById("pp-fonts")) {
  const link = document.createElement("link");
  link.id = "pp-fonts";
  link.rel = "stylesheet";
  link.href = FONT_LINK;
  document.head.appendChild(link);
}
const SERIF = "'Montserrat', 'Poppins', sans-serif";
const SANS = "'Poppins', 'Montserrat', sans-serif";

function normalizeProductImages(product: any): NormalizedImage[] {
  const seen = new Set<string>();
  const result: NormalizedImage[] = [];

  const push = (url: unknown, data: Partial<NormalizedImage> = {}) => {
    if (typeof url !== "string") return;
    const clean = url.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    result.push({
      id: data.id ?? clean,
      url: clean,
      alt: data.alt ?? product?.name ?? "Produto",
      isThumbnail: data.isThumbnail,
      sortOrder: data.sortOrder,
    });
  };

  const arrays = [
    product?.images,
    product?.productImages,
    product?.galleryImages,
    product?.gallery,
    product?.photos,
  ];

  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const img of list) {
      if (typeof img === "string") {
        push(img);
      } else if (img && typeof img === "object") {
        push(img.url ?? img.imageUrl ?? img.src, {
          id: img.id != null ? String(img.id) : undefined,
          alt: img.altText ?? img.alt ?? product?.name,
          isThumbnail: img.isThumbnail,
          sortOrder: img.sortOrder,
        });
      }
    }
  }

  // imageUrl é fallback e também garante compatibilidade com produto antigo.
  push(product?.imageUrl ?? product?.image ?? product?.image_url, {
    id: "main-image",
    alt: product?.name,
    isThumbnail: true,
    sortOrder: -1,
  });

  return result.sort((a, b) => {
    if (a.isThumbnail && !b.isThumbnail) return -1;
    if (!a.isThumbnail && b.isThumbnail) return 1;
    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
  });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 border-b border-neutral-100" />
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-neutral-100 rounded-2xl animate-pulse" style={{ aspectRatio: "1/1" }} />
        <div className="space-y-5 pt-2">
          <div className="h-3 bg-neutral-100 rounded w-24 animate-pulse" />
          <div className="h-8 bg-neutral-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-neutral-100 rounded w-3/4 animate-pulse" />
          <div className="h-20 bg-neutral-100 rounded-2xl animate-pulse mt-4" />
          <div className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ProductPage() {
  const params = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const productQuery = trpc.marketplace.productById.useQuery(
    { id: productId! },
    { enabled: !!productId && !isNaN(productId!) }
  );

  const normalizedImages = useMemo(
    () => productQuery.data ? normalizeProductImages(productQuery.data) : [],
    [productQuery.data]
  );

  useEffect(() => {
    if (
      normalizedImages.length > 0 &&
      (!selectedImageUrl || !normalizedImages.some((img) => img.url === selectedImageUrl))
    ) {
      setSelectedImageUrl(normalizedImages[0].url);
    }
  }, [normalizedImages, selectedImageUrl]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: productQuery.data?.name ?? "Produto", url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  if (!productId || isNaN(productId)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: SANS }}>
        <div className="text-center space-y-4">
          <p className="text-neutral-400">Produto não encontrado.</p>
          <Link href="/vitrine">
            <button className="px-5 py-2.5 border border-neutral-200 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 transition-all">
              ← Voltar ao catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (productQuery.isLoading) return <Skeleton />;

  if (!productQuery.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: SANS }}>
        <div className="text-center space-y-4">
          <ShoppingBag className="w-12 h-12 text-neutral-200 mx-auto" />
          <h2 className="text-lg font-semibold text-neutral-700">Produto não disponível</h2>
          <p className="text-neutral-400 text-sm">Este produto não está mais na vitrine.</p>
          <Link href="/vitrine">
            <button className="mt-2 px-5 py-2.5 border border-neutral-200 text-sm text-neutral-600 hover:border-neutral-400 transition-all">
              ← Voltar ao catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const p: any = productQuery.data;
  const images = normalizedImages;
  const activeImage = selectedImageUrl && images.some((img) => img.url === selectedImageUrl)
    ? selectedImageUrl
    : images[0]?.url ?? null;

  const catLabel = p.categoryLabel || CATEGORY_META[p.category] || p.category;
  const inStock = (p.stockQuantity ?? 0) > 0;
  const isLowStock = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  const pixPriceVal = (p.suggestedPricePix ?? 0) > 0 ? (p.suggestedPricePix as number) : null;
  const fallbackPrice = (p.suggestedPrice ?? 0) > 0 ? (p.suggestedPrice as number) : null;
  const cashPriceVal = pixPriceVal ?? fallbackPrice;
  const cardPriceVal = (p.suggestedPriceCard ?? 0) > 0 ? (p.suggestedPriceCard as number) : null;
  const boletoPriceVal = (p.suggestedPriceBoleto ?? 0) > 0 ? (p.suggestedPriceBoleto as number) : null;
  const cardInst = Math.max(1, Math.round((p as any).cardInstallments ?? 1));
  const boletoMon = Math.max(1, Math.round((p as any).boletoMonths ?? 1));
  const hasPrice = !!(pixPriceVal || cashPriceVal || cardPriceVal || boletoPriceVal);

  const mainCashPrice = cashPriceVal ?? pixPriceVal ?? fallbackPrice;
  const cardInstallmentValue = cardPriceVal && cardInst > 1 ? cardPriceVal / cardInst : null;
  const boletoInstallmentValue = boletoPriceVal && boletoMon > 1 ? boletoPriceVal / boletoMon : null;
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-neutral-100"
        style={{ backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-20 flex items-center justify-between gap-6">
          <Link href="/vitrine">
            <button
              className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-900 text-xs font-medium tracking-wide transition-colors group"
              style={{ fontFamily: SANS }}
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline tracking-[0.15em] uppercase">Catálogo</span>
            </button>
          </Link>

          <Link href="/vitrine">
            <div className="cursor-pointer select-none">
              <img src={logo} alt="Shop PermuPay" className="h-16 sm:h-20 w-auto object-contain" />
            </div>
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-800 text-xs transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline tracking-[0.15em] uppercase">Compartilhar</span>
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-8 md:gap-14 items-start">
          {/* Galeria */}
          <div className="md:sticky md:top-24">
            <div
              className="relative overflow-hidden rounded-3xl bg-white border border-neutral-200 shadow-sm"
              style={{ aspectRatio: "1 / 1" }}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-contain p-3 sm:p-4" style={{ objectPosition: "center center" }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <ShoppingBag className="w-14 h-14 text-neutral-200" />
                  <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-300" style={{ fontFamily: SANS }}>
                    Sem imagem
                  </span>
                </div>
              )}

              {p.promoTag && inStock && (
                <span
                  className="absolute top-4 left-4 text-[8px] font-bold tracking-[0.22em] uppercase px-3 py-1.5 z-10"
                  style={{ backgroundColor: "#111", color: "#fff" }}
                >
                  {p.promoTag}
                </span>
              )}

              {!inStock && (
                <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: "rgba(255,255,255,0.75)" }}>
                  <span
                    className="text-[10px] font-semibold tracking-[0.25em] uppercase border border-neutral-300 px-4 py-2"
                    style={{ color: "#999", backgroundColor: "rgba(255,255,255,0.9)" }}
                  >
                    Indisponível
                  </span>
                </div>
              )}

              {isLowStock && inStock && (
                <span
                  className="absolute bottom-4 left-4 text-[9px] font-semibold tracking-[0.18em] uppercase px-3 py-1.5 z-10 rounded-full"
                  style={{ backgroundColor: "#fbbf24", color: "#78350f" }}
                >
                  Últimas unidades
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageUrl(img.url)}
                    className={`relative rounded-xl border overflow-hidden bg-white transition-all ${
                      activeImage === img.url ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    style={{ aspectRatio: "1 / 1" }}
                    aria-label={`Ver imagem ${img.alt}`}
                  >
                    <img src={img.url} alt={img.alt} className="absolute inset-0 w-full h-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 md:hidden" style={{ fontFamily: SANS }}>
              <Link href="/vitrine">
                <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors">
                  Catálogo
                </span>
              </Link>
              <ChevronRight className="w-3 h-3 text-neutral-300" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-600 line-clamp-1">
                {p.name}
              </span>
            </div>
          </div>

          {/* Detalhes */}
          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-medium tracking-[0.35em] uppercase text-neutral-400 mb-3" style={{ fontFamily: SANS }}>
                {catLabel}
              </p>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(1.5rem, 2.6vw, 2.25rem)",
                  fontWeight: 700,
                  color: "#111",
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.name}
              </h1>
            </div>

            {p.shortDescription && (
              <p className="text-sm text-neutral-500 leading-relaxed font-light" style={{ fontFamily: SANS }}>
                {p.shortDescription}
              </p>
            )}

            {inStock && hasPrice && (
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 mb-3">Valor do produto</p>

                {mainCashPrice && (
                  <div className="mb-4">
                    <span className="text-neutral-900" style={{ fontFamily: SERIF, fontSize: "clamp(2.2rem, 4vw, 3rem)", fontWeight: 700, letterSpacing: "-0.04em" }}>
                      {fmt(mainCashPrice)}
                    </span>
                  </div>
                )}

                <div className="space-y-2 text-sm text-neutral-700" style={{ fontFamily: SANS }}>
                  {mainCashPrice && (
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-neutral-950">Pix ou dinheiro</span>
                      <span className="text-neutral-400">à vista</span>
                    </p>
                  )}
                  {cardPriceVal && (
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-neutral-950">Cartão</span>
                      <span className="text-neutral-500">
                        {cardInstallmentValue ? `ou ${cardInst}x de ${fmt(cardInstallmentValue)}` : `ou ${fmt(cardPriceVal)}`}
                      </span>
                    </p>
                  )}
                  {boletoPriceVal && (
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-neutral-950">Boleto</span>
                      <span className="text-neutral-500">
                        {boletoInstallmentValue ? `ou ${boletoMon}x de ${fmt(boletoInstallmentValue)}` : `ou ${fmt(boletoPriceVal)}`}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {inStock && !hasPrice && (
              <p className="text-sm text-neutral-400 italic" style={{ fontFamily: SANS }}>
                Consulte o preço
              </p>
            )}

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 leading-relaxed">
              Reserve o produto agora. A forma de pagamento será escolhida na reserva e confirmada depois pelo atendimento.
            </div>

            <div className="h-px bg-neutral-100" />

            {inStock ? (
              <div className="space-y-3">
                {hasPrice && (
                  <button
                    onClick={() => setShowBuyModal(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-5 transition-all duration-200 rounded-2xl"
                    style={{ backgroundColor: "#111", color: "#fff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ fontFamily: SANS }}>
                      Reservar produto
                    </span>
                  </button>
                )}

                {!hasPrice && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-5 transition-colors rounded-2xl"
                    style={{ backgroundColor: "#22c55e", color: "#fff" }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold" style={{ fontFamily: SANS }}>Consultar via WhatsApp</span>
                  </a>
                )}
              </div>
            ) : (
              <Link href="/desejos">
                <button
                  className="w-full flex items-center justify-center gap-2.5 py-4 px-5 border border-neutral-200 hover:border-rose-200 hover:bg-rose-50 transition-all rounded-2xl"
                >
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-semibold tracking-[0.2em] uppercase text-neutral-700">
                    Entrar na lista de desejos
                  </span>
                </button>
              </Link>
            )}

            <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
              <span>Quantidade disponível</span>
              <span className={`font-semibold ${inStock ? "text-neutral-700" : "text-rose-500"}`}>
                {inStock ? `${p.stockQuantity ?? 0} un.` : "Indisponível"}
              </span>
            </div>

            {(p.description || p.shortDescription) && (
              <section className="pt-6 border-t border-neutral-100">
                <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 mb-3">Sobre o produto</p>
                <div
                  className="prose prose-neutral max-w-none text-sm text-neutral-500 leading-relaxed whitespace-pre-line"
                  style={{ fontFamily: SANS }}
                >
                  {p.description || p.shortDescription}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {showBuyModal && (
        <BuyModal
          product={p}
          initialPaymentMethod="PIX"
          onClose={() => setShowBuyModal(false)}
        />
      )}
    </div>
  );
}
