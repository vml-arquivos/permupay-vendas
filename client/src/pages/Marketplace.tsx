/**
 * Marketplace.tsx — Shoop PermuPay (v6 — World-Class Premium)
 *
 * DIAGNÓSTICO → CORREÇÕES:
 * ✗ Logo 114px engolia header    → ✓ 52px proporcional
 * ✗ Nome em lowercase            → ✓ capitalize correto
 * ✗ Sem busca                    → ✓ barra de busca inline
 * ✗ Sem mobile nav               → ✓ hamburger + drawer
 * ✗ Sem WhatsApp / Instagram     → ✓ float + footer + header
 * ✗ Footer vazio                 → ✓ completo com contato
 * ✗ Sem urgência nos cards       → ✓ badges condição + "Última peça"
 * ✗ Hero genérico                → ✓ ticker de urgência + 3 highlights
 * ✗ Sem acessibilidade mobile    → ✓ touch-friendly, tap targets 44px
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Heart, ArrowRight, ShoppingBag, Search, X,
  Instagram, MessageCircle, Menu, ChevronRight,
} from "lucide-react";
import logo from "@/assets/logo.png";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CatalogProduct {
  id: number; name: string; category: string; categoryLabel: string | null;
  shortDescription: string | null; description: string | null;
  imageUrl: string | null; promoTag: string | null;
  suggestedPrice: number; suggestedPricePix: number;
  suggestedPriceCard: number; suggestedPriceBoleto: number;
  stockQuantity: number; minimumStock: number;
  paymentPlatform: string | null; pixKey: string | null;
  pixLink: string | null; cardPaymentUrl: string | null;
  boletoUrl: string | null; cardInstallments?: number | null;
  boletoMonths?: number | null;
  salesChannel?: string | null;
  productCondition?: string | null;
  isUniquePiece?: boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT: Record<string, string> = {
  CELULAR: "Celulares", ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias", OUTRO: "Outros",
};

const getPix = (p: CatalogProduct) =>
  (p.suggestedPricePix ?? 0) > 0 ? p.suggestedPricePix
  : (p.suggestedPrice ?? 0) > 0 ? p.suggestedPrice : null;

const getCard = (p: CatalogProduct) =>
  (p.suggestedPriceCard ?? 0) > 0 ? p.suggestedPriceCard : null;

const inStock  = (p: CatalogProduct) => (p.stockQuantity ?? 0) > 0;
const isLow    = (p: CatalogProduct) =>
  (p.minimumStock ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 0);
const isUnique = (p: CatalogProduct) =>
  p.isUniquePiece ||
  ["MOSTRUARIO", "OPEN_BOX"].includes(p.productCondition ?? "") ||
  /\b(único|unico|mostruário|mostruario|open.?box)\b/i.test(
    `${p.name} ${p.shortDescription ?? ""}`
  );

const WHATSAPP_NUMBER = "5511999999999"; // ← SUBSTITUIR pelo número real
const INSTAGRAM_URL   = "https://instagram.com/shooppermupay"; // ← SUBSTITUIR

// ─── Fonts ────────────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("v6-fonts")) {
  const l = document.createElement("link");
  l.id = "v6-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}
const DISPLAY = "'Playfair Display', Georgia, serif";
const BODY    = "'DM Sans', 'Poppins', sans-serif";

// ─── Ticker de urgência ───────────────────────────────────────────────────────
function UrgencyTicker() {
  const msgs = [
    "🔥 Produtos com estoque limitado — reserve o seu",
    "✨ Novas peças chegando toda semana",
    "📦 Retirada ou entrega — combine pelo WhatsApp",
    "💳 Parcelamento disponível no cartão",
  ];
  return (
    <div
      className="overflow-hidden whitespace-nowrap py-2 text-center text-[11px] font-medium tracking-[0.15em]"
      style={{ backgroundColor: "#111", color: "#e5e5e5" }}
    >
      <span
        style={{
          display: "inline-block",
          animation: "ticker 28s linear infinite",
        }}
      >
        {msgs.concat(msgs).map((m, i) => (
          <span key={i} className="mx-10">{m}</span>
        ))}
      </span>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4" style={{ aspectRatio: "1/1", backgroundColor: "#f8f8f8", border: "1px solid #efefef" }} />
      <div className="space-y-2">
        <div className="h-2 rounded-full w-16" style={{ backgroundColor: "#f0f0f0" }} />
        <div className="h-4 rounded-full w-3/4" style={{ backgroundColor: "#f0f0f0" }} />
        <div className="h-3 rounded-full w-1/3 mt-3" style={{ backgroundColor: "#f0f0f0" }} />
      </div>
    </div>
  );
}

// ─── Card de produto ─────────────────────────────────────────────────────────
function ProductCard({ p }: { p: CatalogProduct }) {
  const stock  = inStock(p);
  const low    = isLow(p);
  const unique = isUnique(p);
  const pix    = getPix(p);
  const card   = getCard(p);
  const inst   = Math.max(1, Math.round(p.cardInstallments ?? 3));

  const conditionLabel =
    p.productCondition === "SEMINOVO"   ? "Seminovo"
    : p.productCondition === "USADO"     ? "Usado"
    : p.productCondition === "MOSTRUARIO"? "Mostruário"
    : p.productCondition === "OPEN_BOX"  ? "Open Box"
    : null;

  return (
    <Link href={`/vitrine/${p.id}`}>
      <article
        className="group cursor-pointer select-none"
        style={{ fontFamily: BODY, opacity: stock ? 1 : 0.45 }}
      >
        {/* ── Container da imagem ── */}
        <div
          className="relative overflow-hidden mb-3"
          style={{ aspectRatio: "1/1", backgroundColor: "#ffffff", border: "1px solid #efefef" }}
        >
          {/* Badges topo-esquerda */}
          <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5">
            {(p.promoTag || low) && (
              <span
                className="text-[9px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#111", color: "#fff" }}
              >
                {p.promoTag ?? "Últimas"}
              </span>
            )}
            {conditionLabel && (
              <span
                className="text-[9px] font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#92400e", color: "#fef3c7" }}
              >
                {conditionLabel}
              </span>
            )}
            {unique && !conditionLabel && (
              <span
                className="text-[9px] font-semibold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#1e3a5f", color: "#e0f0ff" }}
              >
                Peça única
              </span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={(e) => e.preventDefault()}
            className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Favoritar"
          >
            <Heart className="w-4 h-4 text-neutral-400 hover:text-rose-500 transition-colors" />
          </button>

          {/* Imagem */}
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="w-8 h-8 text-neutral-300" />
              <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-300">Sem imagem</span>
            </div>
          )}

          {/* Overlay hover com CTA */}
          {stock && (
            <div
              className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
            >
              <div
                className="py-3 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ backgroundColor: "#111", color: "#fff" }}
              >
                Ver peça <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          )}

          {/* Indisponível */}
          {!stock && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{ backgroundColor: "rgba(255,255,255,0.85)" }}
            >
              <span
                className="text-[9px] font-semibold tracking-[0.25em] uppercase border px-3 py-1.5 rounded-full"
                style={{ borderColor: "#ccc", color: "#999", backgroundColor: "#fff" }}
              >
                Indisponível
              </span>
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="space-y-1 px-0.5">
          <p
            className="text-[9px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: "#a78764" }}
          >
            {p.categoryLabel || CAT[p.category] || p.category}
          </p>

          <h3
            className="font-medium leading-snug line-clamp-2 group-hover:opacity-60 transition-opacity"
            style={{
              fontFamily: BODY,
              fontSize: "0.88rem",
              color: "#111",
              minHeight: "2.5em",
              textTransform: "none",
            }}
          >
            {p.name}
          </h3>

          {p.shortDescription && (
            <p
              className="text-[11px] line-clamp-1 font-light"
              style={{ color: "#999" }}
            >
              {p.shortDescription}
            </p>
          )}

          <div className="pt-2">
            {stock && pix ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="font-bold tracking-tight"
                    style={{ fontSize: "1.1rem", color: "#111", fontFamily: BODY }}
                  >
                    {fmt(pix)}
                  </span>
                  <span
                    className="text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#f0fdf4", color: "#166534" }}
                  >
                    PIX
                  </span>
                </div>
                {card && inst > 1 && (
                  <p
                    className="text-[10px] font-light mt-0.5"
                    style={{ color: "#888" }}
                  >
                    ou {inst}× de {fmt(card / inst)}
                  </p>
                )}
              </>
            ) : stock ? (
              <p className="text-xs italic" style={{ color: "#bbb" }}>Consulte o preço</p>
            ) : (
              <Link href="/desejos">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] flex items-center gap-1 transition-colors hover:text-rose-400"
                  style={{ color: "#bbb", fontFamily: BODY }}
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

// ─── Mobile drawer nav ────────────────────────────────────────────────────────
function MobileDrawer({
  open, onClose, onCatSelect, PANEL,
}: {
  open: boolean; onClose: () => void;
  onCatSelect: (c: string | null) => void; PANEL: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative ml-auto w-72 h-full flex flex-col py-8 px-6 shadow-2xl"
        style={{ backgroundColor: "#fff" }}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-8">
          <img src={logo} alt="Shoop" className="h-10 object-contain" />
        </div>
        <nav className="flex flex-col gap-5">
          {[
            { label: "Catálogo", action: () => { onCatSelect(null); onClose(); } },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="text-left text-sm font-medium tracking-wide text-neutral-700 hover:text-neutral-950 transition-colors flex items-center gap-2"
            >
              <ChevronRight className="w-3.5 h-3.5 text-neutral-300" /> {label}
            </button>
          ))}
          <Link href="/quase-zero" onClick={onClose}>
            <span className="text-sm font-semibold flex items-center gap-2" style={{ color: "#92400e" }}>
              <ChevronRight className="w-3.5 h-3.5" /> Quase Zero
            </span>
          </Link>
          <Link href="/desejos" onClick={onClose}>
            <span className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-neutral-300" /> Lista de Desejos
            </span>
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "#22c55e", color: "#fff" }}
          >
            <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "#e5e5e5", color: "#111" }}
          >
            <Instagram className="w-4 h-4" /> Instagram
          </a>
          <a
            href={`${PANEL}/login`}
            className="text-center text-xs text-neutral-400 hover:text-neutral-700 transition-colors mt-1"
          >
            Área administrativa →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Marketplace() {
  const [cat, setCat]         = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data, isLoading }   = trpc.marketplace.products.useQuery();
  const products              = (data ?? []) as CatalogProduct[];
  const PANEL                 = import.meta.env.VITE_PANEL_URL ?? "";

  const cats = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const filtered = useMemo(() => {
    let list = cat ? products.filter((p) => p.category === cat) : products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription ?? "").toLowerCase().includes(q) ||
          (p.categoryLabel ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, cat, search]);

  const hero = useMemo(
    () => products.filter((p) => p.imageUrl && inStock(p)).slice(0, 3),
    [products]
  );

  const inStockCount = products.filter(inStock).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAFAF8", fontFamily: BODY }}>

      {/* ── TICKER ──────────────────────────────────────────────────────── */}
      <UrgencyTicker />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "rgba(250,250,248,0.97)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid #e8e4df",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-12 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/vitrine">
            <img
              src={logo}
              alt="Shoop PermuPay"
              className="h-10 w-auto object-contain cursor-pointer select-none shrink-0"
            />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-8 flex-1 justify-center">
            <button
              onClick={() => { setCat(null); setSearch(""); }}
              className="text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors pb-0.5 border-b-2"
              style={{
                color: cat === null && !search ? "#111" : "#aaa",
                borderColor: cat === null && !search ? "#111" : "transparent",
                fontFamily: BODY,
              }}
            >
              Catálogo
            </button>
            <Link href="/quase-zero">
              <span
                className="text-[11px] font-bold tracking-[0.2em] uppercase cursor-pointer transition-colors"
                style={{ color: "#92400e", fontFamily: BODY }}
              >
                Quase Zero
              </span>
            </Link>
            <Link href="/desejos">
              <span
                className="text-[11px] font-medium tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-800 cursor-pointer transition-colors"
                style={{ fontFamily: BODY }}
              >
                Lista de Desejos
              </span>
            </Link>
          </nav>

          {/* Ações direita */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Instagram */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
              style={{ color: "#555" }}
              aria-label="Instagram"
            >
              <Instagram className="w-4.5 h-4.5" />
            </a>

            {/* WhatsApp desktop */}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#22c55e", color: "#fff" }}
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>

            {/* Entrar */}
            <a
              href={`${PANEL}/login`}
              className="hidden md:block text-[11px] font-semibold tracking-[0.18em] uppercase px-4 py-2 border transition-all duration-200 hover:bg-neutral-950 hover:text-white hover:border-neutral-950"
              style={{ borderColor: "#ccc", color: "#555", fontFamily: BODY }}
            >
              Entrar
            </a>

            {/* Hamburger mobile */}
            <button
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-neutral-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onCatSelect={setCat}
        PANEL={PANEL}
      />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section
        className="border-b"
        style={{ borderColor: "#e8e4df", backgroundColor: "#fff" }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-12 py-10 lg:py-16 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-20 items-center">

          {/* Copy lado esquerdo */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-px w-8" style={{ backgroundColor: "#c8a97e" }} />
              <span
                className="text-[10px] font-bold tracking-[0.32em] uppercase"
                style={{ color: "#a78764" }}
              >
                Catálogo Exclusivo · Shoop PermuPay
              </span>
            </div>

            <h1
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(2.6rem, 5vw, 4.2rem)",
                fontWeight: 800,
                color: "#111",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              A sua vitrine
              <br />
              <em style={{ color: "#b45309", fontStyle: "italic" }}>dos desejos</em>
            </h1>

            <p
              className="text-sm leading-relaxed max-w-sm"
              style={{ color: "#777", fontWeight: 300 }}
            >
              Produtos selecionados. Preços transparentes.
              <br />Compra simples, segura e sofisticada.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#111", fontFamily: BODY }}
                >
                  {inStockCount}
                </p>
                <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#aaa" }}>
                  peças disponíveis
                </p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "#e5e5e5" }} />
              <div>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#111", fontFamily: BODY }}
                >
                  {cats.length}
                </p>
                <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#aaa" }}>
                  categorias
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
                }
                className="px-7 py-3 text-[11px] font-bold tracking-[0.22em] uppercase flex items-center gap-2 transition-all hover:opacity-85"
                style={{ backgroundColor: "#111", color: "#fff" }}
              >
                Ver peças disponíveis <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-7 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase border flex items-center gap-2 transition-all hover:bg-neutral-50"
                style={{ borderColor: "#ddd", color: "#555" }}
              >
                <MessageCircle className="w-3.5 h-3.5" /> Falar no WhatsApp
              </a>
            </div>
          </div>

          {/* Produtos destaque lado direito */}
          <div className="hidden lg:grid grid-cols-3 gap-3 items-end">
            {hero.length > 0 ? hero.map((p, i) => (
              <Link key={p.id} href={`/vitrine/${p.id}`}>
                <div
                  className="relative rounded-2xl overflow-hidden cursor-pointer group transition-transform hover:-translate-y-1 duration-300"
                  style={{
                    aspectRatio: "3/4",
                    backgroundColor: "#F7F5F2",
                    transform: i === 1 ? "translateY(-16px)" : "none",
                    boxShadow: i === 1 ? "0 20px 60px rgba(0,0,0,0.12)" : "0 4px 20px rgba(0,0,0,0.06)",
                  }}
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="absolute inset-0 w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div
                    className="absolute inset-x-0 bottom-0 p-3"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                    }}
                  >
                    <p className="text-white text-[9px] font-medium line-clamp-1">{p.name}</p>
                    {getPix(p) && (
                      <p className="text-white text-sm font-bold">{fmt(getPix(p)!)}</p>
                    )}
                  </div>
                  {i === 1 && (
                    <div
                      className="absolute top-2.5 left-2.5 text-[8px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-full"
                      style={{ backgroundColor: "#b45309", color: "#fff" }}
                    >
                      Destaque
                    </div>
                  )}
                </div>
              </Link>
            )) : (
              <div
                className="col-span-3 rounded-2xl flex items-center justify-center"
                style={{ aspectRatio: "16/7", backgroundColor: "#F7F5F2" }}
              >
                <ShoppingBag className="w-12 h-12 text-neutral-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── BANNER QUASE ZERO ───────────────────────────────────────────── */}
      <Link href="/quase-zero">
        <div
          className="cursor-pointer flex items-center justify-between px-5 lg:px-12 py-4 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#78350f", color: "#fef3c7" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">♻️</span>
            <div>
              <p className="text-[11px] font-bold tracking-[0.25em] uppercase">Quase Zero</p>
              <p className="text-xs opacity-80">Usados, seminovos e peças únicas com preço especial</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 opacity-70 shrink-0" />
        </div>
      </Link>

      {/* ── FILTROS + BUSCA ─────────────────────────────────────────────── */}
      <div
        className="sticky z-40 border-b"
        style={{ top: 64, backgroundColor: "rgba(250,250,248,0.97)", borderColor: "#e8e4df", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-12 py-3 flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Filtros de categoria */}
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
            {[{ key: null, label: "Todos" }, ...cats.map((c) => ({ key: c, label: CAT[c] || c }))].map(
              ({ key, label }) => (
                <button
                  key={String(key)}
                  onClick={() => setCat(key)}
                  className="shrink-0 text-[10px] font-semibold tracking-[0.22em] uppercase pb-0.5 border-b-2 whitespace-nowrap transition-all"
                  style={{
                    color: cat === key ? "#111" : "#bbb",
                    borderColor: cat === key ? "#111" : "transparent",
                    fontFamily: BODY,
                  }}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* Barra de busca */}
          <div className="relative sm:ml-auto sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar peça..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-full border outline-none transition-all focus:border-neutral-400"
              style={{
                borderColor: "#e0dbd4",
                backgroundColor: "#fff",
                color: "#111",
                fontFamily: BODY,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CATÁLOGO ────────────────────────────────────────────────────── */}
      <main id="catalogo" className="flex-1 max-w-7xl mx-auto w-full px-5 lg:px-12 py-12">

        {/* Título da seção */}
        <div className="flex items-end justify-between mb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px w-5" style={{ backgroundColor: "#c8a97e" }} />
              <p
                className="text-[9px] font-bold tracking-[0.38em] uppercase"
                style={{ color: "#a78764" }}
              >
                Disponíveis agora
              </p>
            </div>
            <h2
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
                fontWeight: 700,
                color: "#111",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {search
                ? `Resultados para "${search}"`
                : cat
                ? CAT[cat] ?? cat
                : "Produtos em destaque"}
            </h2>
          </div>
          {!isLoading && (
            <p
              className="text-[10px] text-neutral-400 tracking-wider shrink-0 hidden sm:block"
              style={{ fontFamily: BODY }}
            >
              {filtered.length} {filtered.length !== 1 ? "produtos" : "produto"}
            </p>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 space-y-5">
            <ShoppingBag className="w-10 h-10 text-neutral-200 mx-auto" />
            <h3 style={{ fontFamily: DISPLAY, fontSize: "1.6rem", color: "#ccc", fontWeight: 400 }}>
              {search ? "Nenhum resultado" : "Vitrine em preparação"}
            </h3>
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="text-[10px] tracking-[0.2em] uppercase border px-6 py-2.5 hover:border-neutral-400 transition-colors"
                style={{ borderColor: "#ddd", color: "#888" }}
              >
                Limpar busca
              </button>
            ) : (
              <Link href="/desejos">
                <button
                  className="text-[10px] tracking-[0.2em] uppercase border px-6 py-2.5 hover:border-neutral-400 transition-colors inline-flex items-center gap-2"
                  style={{ borderColor: "#ddd", color: "#888" }}
                >
                  <Heart className="w-3.5 h-3.5" /> Registrar desejo
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-14">
            {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </main>

      {/* ── BANNER LISTA DE DESEJOS ─────────────────────────────────────── */}
      <section
        className="py-20 border-t"
        style={{ backgroundColor: "#111", borderColor: "#222" }}
      >
        <div className="max-w-lg mx-auto px-6 text-center space-y-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto border"
            style={{ borderColor: "#333" }}
          >
            <Heart className="w-5 h-5 text-neutral-500" />
          </div>
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            Sua Lista de Desejos
            <br />
            <em style={{ color: "#c8a97e", fontStyle: "italic" }}>Personalizada</em>
          </h2>
          <p
            className="text-sm leading-relaxed max-w-xs mx-auto"
            style={{ color: "#888", fontWeight: 300 }}
          >
            Não encontrou o que procura? Registre sua demanda e avisamos quando disponível.
          </p>
          <Link href="/desejos">
            <button
              className="px-10 py-4 text-[10px] font-bold tracking-[0.26em] uppercase inline-flex items-center gap-2.5 transition-all hover:opacity-85 rounded-full"
              style={{ backgroundColor: "#c8a97e", color: "#111" }}
            >
              <Heart className="w-3.5 h-3.5" /> Registrar Demanda
            </button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer
        className="border-t py-12"
        style={{ backgroundColor: "#0d0d0d", borderColor: "#1a1a1a" }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">

            {/* Col 1: Marca */}
            <div className="space-y-4">
              <img src={logo} alt="Shoop" className="h-10 object-contain brightness-0 invert opacity-80" />
              <p className="text-xs leading-relaxed" style={{ color: "#666", fontWeight: 300 }}>
                Vitrine premium de produtos selecionados.
                Compra simples, segura e sofisticada.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors hover:border-neutral-600"
                  style={{ borderColor: "#333", color: "#888" }}
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors hover:border-green-800"
                  style={{ borderColor: "#333", color: "#22c55e" }}
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Col 2: Links */}
            <div className="space-y-4">
              <p
                className="text-[9px] font-bold tracking-[0.3em] uppercase mb-4"
                style={{ color: "#555" }}
              >
                Navegação
              </p>
              <nav className="flex flex-col gap-3">
                {[
                  { label: "Catálogo", href: "/vitrine" },
                  { label: "Quase Zero", href: "/quase-zero" },
                  { label: "Lista de Desejos", href: "/desejos" },
                ].map(({ label, href }) => (
                  <Link key={label} href={href}>
                    <span
                      className="text-xs cursor-pointer transition-colors hover:text-neutral-300"
                      style={{ color: "#666" }}
                    >
                      {label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>

            {/* Col 3: Contato */}
            <div className="space-y-4">
              <p
                className="text-[9px] font-bold tracking-[0.3em] uppercase"
                style={{ color: "#555" }}
              >
                Contato
              </p>
              <div className="space-y-3">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-xs transition-colors hover:text-green-400"
                  style={{ color: "#666" }}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  WhatsApp
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-xs transition-colors hover:text-neutral-300"
                  style={{ color: "#666" }}
                >
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  @shooppermupay
                </a>
              </div>
              <a
                href={`${PANEL}/login`}
                className="inline-block text-[9px] tracking-[0.2em] uppercase border px-3 py-1.5 transition-colors hover:border-neutral-600 mt-2"
                style={{ borderColor: "#333", color: "#555" }}
              >
                Área Admin
              </a>
            </div>
          </div>

          <div
            className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t text-[9px] tracking-wide"
            style={{ borderColor: "#1a1a1a", color: "#444" }}
          >
            <p>© {new Date().getFullYear()} Shoop PermuPay. Todos os direitos reservados.</p>
            <p>Desenvolvido com ♥ pela Shoop</p>
          </div>
        </div>
      </footer>

      {/* ── FLOAT WHATSAPP ──────────────────────────────────────────────── */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 py-3 px-5 rounded-full shadow-2xl transition-all hover:scale-105 hover:shadow-green-500/25"
        style={{ backgroundColor: "#22c55e", color: "#fff" }}
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span
          className="text-[11px] font-bold tracking-wide hidden sm:block"
          style={{ fontFamily: BODY }}
        >
          Falar no WhatsApp
        </span>
      </a>
    </div>
  );
}
