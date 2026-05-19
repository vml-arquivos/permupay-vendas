/**
 * ProductPage.tsx — Página de Produto Premium (v5 — Visual Refinado)
 *
 * MELHORIAS APLICADAS:
 * ─ Imagem: container com aspect-ratio 1/1 + object-cover (não contain)
 *   → imagem preenche o espaço inteiramente, sem bordas cinzas
 * ─ Layout: padding mínimo no header, conteúdo respira melhor
 * ─ Hierarquia de preços: PIX em destaque primário, cartão/boleto secundários
 * ─ Botão PIX: ao clicar abre modal com QR Code + copia e cola
 * ─ Botões de pagamento com hover states suaves e consistentes
 * ─ Sticky image: imagem fica fixa no scroll em desktop
 * ─ Typography: Montserrat/Poppins consistente com o Marketplace
 * ─ Toda a lógica de negócio e BuyModal 100% intactos
 */
import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Zap, CreditCard, FileText, MessageCircle,
  Heart, Copy, CheckCheck, Share2, X, QrCode, ShoppingBag, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { BuyModal } from "@/components/BuyModal";
import logo from "@/assets/logo.png";

const fmt = (v: number | null | undefined): string => {
  if (v == null || v === 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};

const CATEGORY_META: Record<string, string> = {
  CELULAR: "Celulares", ELETRONICO: "Eletrônicos",
  PERFUME: "Perfumes & Fragrâncias", OUTRO: "Outros",
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap";
if (typeof document !== "undefined" && !document.getElementById("pp-fonts")) {
  const link = document.createElement("link");
  link.id = "pp-fonts"; link.rel = "stylesheet"; link.href = FONT_LINK;
  document.head.appendChild(link);
}
const SERIF = "'Montserrat', 'Poppins', sans-serif";
const SANS  = "'Poppins', 'Montserrat', sans-serif";

// ── Modal PIX com QR Code + copia e cola ─────────────────────────────────────
function PixModal({
  pixKey, pixLink, price, productName, onClose,
}: {
  pixKey: string | null; pixLink: string | null;
  price: number | null; productName: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = pixKey ?? pixLink ?? "";
  const qrUrl = text
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=111111&margin=12`
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ fontFamily: SANS }}
      >
        {/* Header do modal */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Pagar com PIX</h3>
              {price && (
                <p className="text-xl font-black text-neutral-900" style={{ letterSpacing: "-0.02em" }}>
                  {fmt(price)}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Nome do produto */}
          <p className="text-xs text-neutral-400 line-clamp-2 font-light">{productName}</p>

          {/* QR Code */}
          {qrUrl && (
            <div className="flex justify-center">
              <div className="p-4 border border-neutral-100 rounded-2xl bg-neutral-50 inline-block">
                <img src={qrUrl} alt="QR Code PIX" width={200} height={200} className="rounded-lg block" />
              </div>
            </div>
          )}

          {/* Copia e cola */}
          {text && (
            <div>
              <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-neutral-400 mb-2">
                PIX Copia e Cola
              </p>
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-3">
                <code className="text-xs text-neutral-700 flex-1 truncate font-mono text-left select-all">
                  {text}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  {copied
                    ? <CheckCheck className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4 text-neutral-400" />}
                </button>
              </div>
            </div>
          )}

          {/* Link externo */}
          {pixLink && (
            <a
              href={pixLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: "#111" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
            >
              Abrir link de pagamento <ChevronRight className="w-4 h-4" />
            </a>
          )}

          <p className="text-xs text-neutral-400 leading-relaxed text-center">
            Abra o app do seu banco, escaneie o QR Code ou use o PIX Copia e Cola.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 border-b border-neutral-100" />
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-16">
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
  const [showPixModal, setShowPixModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const productQuery = trpc.marketplace.productById.useQuery(
    { id: productId! },
    { enabled: !!productId && !isNaN(productId!) }
  );

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

  const p = productQuery.data;
  const catLabel    = p.categoryLabel || CATEGORY_META[p.category] || p.category;
  const inStock     = (p.stockQuantity ?? 0) > 0;
  const isLowStock  = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  const pixPriceVal    = (p.suggestedPricePix    ?? 0) > 0 ? (p.suggestedPricePix    as number) : null;
  const cardPriceVal   = (p.suggestedPriceCard   ?? 0) > 0 ? (p.suggestedPriceCard   as number) : null;
  const boletoPriceVal = (p.suggestedPriceBoleto ?? 0) > 0 ? (p.suggestedPriceBoleto as number) : null;
  const cardInst       = Math.max(1, Math.round((p as any).cardInstallments ?? 1));
  const boletoMon      = Math.max(1, Math.round((p as any).boletoMonths     ?? 1));
  const hasPrice       = !!(pixPriceVal || cardPriceVal || boletoPriceVal);
  const hasPixPayment  = !!(p.pixKey || p.pixLink);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: SANS }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-neutral-100"
        style={{ backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          {/* Voltar */}
          <Link href="/vitrine">
            <button
              className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-900 text-xs font-medium tracking-wide transition-colors group"
              style={{ fontFamily: SANS }}
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline tracking-[0.15em] uppercase">Catálogo</span>
            </button>
          </Link>

          {/* Logo */}
          <Link href="/vitrine">
            <div className="cursor-pointer select-none">
              <img src={logo} alt="Shop PermuPay" className="h-8 w-auto object-contain" />
            </div>
          </Link>

          {/* Compartilhar */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-800 text-xs transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline tracking-[0.15em] uppercase">Compartilhar</span>
          </button>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ─────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-10 md:gap-20 items-start">

          {/* ── COLUNA DA IMAGEM ── sticky no desktop ── */}
          <div className="md:sticky md:top-20">
            {/*
             * Container BLINDADO:
             * aspect-ratio 1/1 garante quadrado perfeito.
             * object-cover preenche sem corte visível nem espaços em branco.
             * Sem padding interno — a imagem ocupa 100% do espaço.
             */}
            <div
              className="relative overflow-hidden rounded-2xl bg-neutral-50"
              style={{ aspectRatio: "1 / 1" }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  /* object-cover: sem padding, sem corte em bordas bizarras */
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <ShoppingBag className="w-14 h-14 text-neutral-200" />
                  <span
                    className="text-[9px] tracking-[0.3em] uppercase text-neutral-300"
                    style={{ fontFamily: SANS }}
                  >
                    Sem imagem
                  </span>
                </div>
              )}

              {/* Badge promoção */}
              {p.promoTag && inStock && (
                <span
                  className="absolute top-4 left-4 text-[8px] font-bold tracking-[0.22em] uppercase px-3 py-1.5 z-10"
                  style={{ backgroundColor: "#111", color: "#fff" }}
                >
                  {p.promoTag}
                </span>
              )}

              {/* Overlay indisponível */}
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

              {/* Badge estoque baixo */}
              {isLowStock && inStock && (
                <span
                  className="absolute bottom-4 left-4 text-[9px] font-semibold tracking-[0.18em] uppercase px-3 py-1.5 z-10"
                  style={{ backgroundColor: "#fbbf24", color: "#78350f" }}
                >
                  Últimas unidades
                </span>
              )}
            </div>

            {/* Breadcrumb mobile */}
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

          {/* ── COLUNA DE DETALHES ── */}
          <div className="space-y-7">

            {/* Categoria */}
            <div>
              <p
                className="text-[9px] font-medium tracking-[0.35em] uppercase text-neutral-400 mb-3"
                style={{ fontFamily: SANS }}
              >
                {catLabel}
              </p>
              {/* Nome do produto */}
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                  fontWeight: 700,
                  color: "#111",
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.name}
              </h1>
            </div>

            {/* Descrição curta */}
            {p.shortDescription && (
              <p
                className="text-sm text-neutral-500 leading-relaxed font-light"
                style={{ fontFamily: SANS }}
              >
                {p.shortDescription}
              </p>
            )}

            {/* ── BLOCO DE PREÇOS ── */}
            {inStock && hasPrice && (
              <div className="space-y-2 py-1">
                {/* PIX — preço principal em destaque */}
                {pixPriceVal && (
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-neutral-900"
                      style={{ fontFamily: SERIF, fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.03em" }}
                    >
                      {fmt(pixPriceVal)}
                    </span>
                    <span
                      className="text-[8px] font-bold tracking-[0.25em] uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full"
                      style={{ fontFamily: SANS }}
                    >
                      no PIX
                    </span>
                  </div>
                )}

                {/* Cartão */}
                {cardPriceVal && (
                  <p className="text-sm text-neutral-400 font-light" style={{ fontFamily: SANS }}>
                    {pixPriceVal && "ou "}
                    {cardInst > 1 ? (
                      <>
                        <span className="font-medium text-neutral-700">{cardInst}× de {fmt(cardPriceVal / cardInst)}</span>
                        {" no cartão"}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-neutral-700">{fmt(cardPriceVal)}</span>
                        {" no cartão"}
                      </>
                    )}
                  </p>
                )}

                {/* Boleto */}
                {boletoPriceVal && (
                  <p className="text-sm text-neutral-400 font-light" style={{ fontFamily: SANS }}>
                    {(pixPriceVal || cardPriceVal) && "ou "}
                    {boletoMon > 1 ? (
                      <>
                        <span className="font-medium text-neutral-600">{boletoMon}× de {fmt(boletoPriceVal / boletoMon)}</span>
                        {" no boleto"}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-neutral-600">{fmt(boletoPriceVal)}</span>
                        {" no boleto"}
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {inStock && !hasPrice && (
              <p className="text-sm text-neutral-400 italic" style={{ fontFamily: SANS }}>Consulte o preço</p>
            )}

            {/* Divisor */}
            <div className="h-px bg-neutral-100" />

            {/* ── BOTÕES DE PAGAMENTO ── */}
            {inStock ? (
              <div className="space-y-3">
                {/* PIX — botão primário se houver chave/link */}
                {hasPixPayment && (
                  <button
                    onClick={() => setShowPixModal(true)}
                    className="w-full flex items-center justify-between gap-3 py-4 px-5 transition-all duration-200 group"
                    style={{ backgroundColor: "#111", color: "#fff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#333"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#111"; }}
                  >
                    <span className="flex items-center gap-3" style={{ fontFamily: SANS }}>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <QrCode className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm font-semibold tracking-wide">Pagar com PIX</span>
                    </span>
                    {pixPriceVal && (
                      <span className="text-sm font-bold shrink-0">{fmt(pixPriceVal)}</span>
                    )}
                  </button>
                )}

                {/* Cartão */}
                {p.cardPaymentUrl && (
                  <a
                    href={p.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-3 py-3.5 px-5 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all duration-200 group"
                  >
                    <span className="flex items-center gap-3" style={{ fontFamily: SANS }}>
                      <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                        <CreditCard className="w-4 h-4 text-neutral-500" />
                      </div>
                      <span className="text-sm font-medium text-neutral-800 tracking-wide">Pagar com Cartão</span>
                    </span>
                    {cardPriceVal && cardInst > 1 ? (
                      <span className="text-xs text-neutral-400 shrink-0">{cardInst}× de {fmt(cardPriceVal / cardInst)}</span>
                    ) : cardPriceVal ? (
                      <span className="text-xs text-neutral-400 shrink-0">{fmt(cardPriceVal)}</span>
                    ) : null}
                  </a>
                )}

                {/* Boleto */}
                {p.boletoUrl && (
                  <a
                    href={p.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-3 py-3.5 px-5 border border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200 group"
                  >
                    <span className="flex items-center gap-3" style={{ fontFamily: SANS }}>
                      <div className="w-7 h-7 rounded-lg bg-neutral-50 flex items-center justify-center group-hover:bg-neutral-100 transition-colors">
                        <FileText className="w-4 h-4 text-neutral-400" />
                      </div>
                      <span className="text-sm font-medium text-neutral-600 tracking-wide">Gerar Boleto</span>
                    </span>
                    {boletoPriceVal && boletoMon > 1 ? (
                      <span className="text-xs text-neutral-400 shrink-0">{boletoMon}× de {fmt(boletoPriceVal / boletoMon)}</span>
                    ) : boletoPriceVal ? (
                      <span className="text-xs text-neutral-400 shrink-0">{fmt(boletoPriceVal)}</span>
                    ) : null}
                  </a>
                )}

                {/* CTA principal: modal de pedido (BuyModal) */}
                {hasPrice && (
                  <button
                    onClick={() => setShowBuyModal(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-5 transition-all duration-200 border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    <ShoppingBag className="w-4 h-4 text-neutral-500" />
                    <span
                      className="text-xs font-semibold tracking-[0.2em] uppercase text-neutral-700"
                      style={{ fontFamily: SANS }}
                    >
                      Ir para o pagamento
                    </span>
                  </button>
                )}

                {/* Sem nenhum método — WhatsApp */}
                {!hasPrice && !hasPixPayment && !p.cardPaymentUrl && !p.boletoUrl && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-5 transition-colors"
                    style={{ backgroundColor: "#22c55e", color: "#fff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#16a34a"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#22c55e"; }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold" style={{ fontFamily: SANS }}>Consultar via WhatsApp</span>
                  </a>
                )}
              </div>
            ) : (
              /* Indisponível */
              <div className="space-y-3">
                <p className="text-sm text-neutral-400 font-light" style={{ fontFamily: SANS }}>
                  Este produto está temporariamente indisponível.
                </p>
                <Link href="/desejos">
                  <button
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-5 border-2 border-dashed border-neutral-200 hover:border-neutral-400 hover:text-neutral-700 text-neutral-400 transition-all text-sm font-medium"
                    style={{ fontFamily: SANS }}
                  >
                    <Heart className="w-4 h-4" />
                    Avisar quando chegar
                  </button>
                </Link>
              </div>
            )}

            {/* Estoque disponível */}
            {inStock && (
              <p className="text-[10px] text-neutral-300 tracking-wide" style={{ fontFamily: SANS }}>
                {p.stockQuantity} {p.stockQuantity === 1 ? "unidade disponível" : "unidades disponíveis"}
              </p>
            )}
          </div>
        </div>

        {/* ── DESCRIÇÃO COMPLETA ── */}
        {p.description && (
          <div className="mt-20 max-w-2xl border-t border-neutral-100 pt-12">
            <p
              className="text-[9px] font-medium tracking-[0.35em] uppercase text-neutral-400 mb-5"
              style={{ fontFamily: SANS }}
            >
              Sobre o produto
            </p>
            <div
              className="text-sm text-neutral-500 leading-relaxed whitespace-pre-wrap font-light"
              style={{ fontFamily: SANS }}
            >
              {p.description}
            </div>
          </div>
        )}

        {/* ── VOLTAR ── */}
        <div className="mt-16 pt-10 border-t border-neutral-100">
          <Link href="/vitrine">
            <button
              className="inline-flex items-center gap-2 text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-800 transition-colors group"
              style={{ fontFamily: SANS }}
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="mt-8 border-t border-neutral-100 py-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <nav className="flex items-center gap-6">
            <Link href="/vitrine">
              <span
                className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors"
                style={{ fontFamily: SANS }}
              >
                Catálogo
              </span>
            </Link>
            <Link href="/desejos">
              <span
                className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors"
                style={{ fontFamily: SANS }}
              >
                Lista de Desejos
              </span>
            </Link>
          </nav>
          <p className="text-[9px] text-neutral-300 tracking-wide" style={{ fontFamily: SANS }}>
            © {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* ── MODAIS ── */}
      {showPixModal && (
        <PixModal
          pixKey={p.pixKey ?? null}
          pixLink={p.pixLink ?? null}
          price={pixPriceVal}
          productName={p.name}
          onClose={() => setShowPixModal(false)}
        />
      )}

      {showBuyModal && (
        <BuyModal
          product={{
            id: p.id,
            name: p.name,
            suggestedPricePix:    p.suggestedPricePix    ?? 0,
            suggestedPriceCard:   p.suggestedPriceCard   ?? 0,
            suggestedPriceBoleto: p.suggestedPriceBoleto ?? 0,
            suggestedPrice:       p.suggestedPrice       ?? 0,
            cardInstallments:     (p as any).cardInstallments,
            boletoMonths:         (p as any).boletoMonths,
          }}
          onClose={() => setShowBuyModal(false)}
        />
      )}
    </div>
  );
}
