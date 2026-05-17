/**
 * ProductPage.tsx — Página individual de produto na vitrine pública
 * Rota: /vitrine/:id
 *
 * REGRAS NÃO NEGOCIÁVEIS:
 * - Foto NÃO cortada: object-contain dentro de área quadrada com fundo neutro
 * - Layout premium delicado (duas colunas: foto | detalhes)
 * - Preço PIX em destaque máximo (text-4xl font-black)
 * - Cartão: "3x de" pequeno + valor da parcela grande
 * - Boleto: "Xx de" pequeno + valor da parcela grande
 * - Ao clicar em "Pagar com PIX": abre modal com QR Code + copia-e-cola
 * - Nunca expõe custo, margem ou dados internos
 */
import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Zap,
  CreditCard,
  FileText,
  MessageCircle,
  Heart,
  Copy,
  CheckCheck,
  Share2,
  X,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const CATEGORY_META: Record<string, string> = {
  CELULAR:    "Celulares",
  ELETRONICO: "Eletrônicos",
  PERFUME:    "Perfumes",
  OUTRO:      "Outros",
};

// ── Modal PIX ─────────────────────────────────────────────────────────────────
function PixModal({
  pixKey,
  pixLink,
  price,
  productName,
  onClose,
}: {
  pixKey: string | null;
  pixLink: string | null;
  price: number | null;
  productName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = pixKey ?? pixLink ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

  // QR Code via API pública — sem dependência extra
  const qrData = pixKey ?? pixLink ?? "";
  const qrUrl  = qrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=1c1917&margin=10`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <Zap className="w-7 h-7 text-emerald-500" />
        </div>

        <h3 className="text-lg font-bold text-stone-900 mb-1">Pagar com PIX</h3>
        <p className="text-sm text-stone-400 mb-1 line-clamp-1">{productName}</p>
        {price && (
          <p className="text-2xl font-black text-stone-900 mb-6">{fmt(price)}</p>
        )}

        {/* QR Code */}
        {qrUrl && (
          <div className="flex justify-center mb-5">
            <div className="p-3 border border-stone-100 rounded-2xl bg-stone-50 inline-block">
              <img
                src={qrUrl}
                alt="QR Code PIX"
                width={180}
                height={180}
                className="rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Chave copia-e-cola */}
        {pixKey && (
          <div className="mb-5">
            <p className="text-xs text-stone-400 mb-2">Ou copie a chave PIX:</p>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5">
              <code className="text-xs text-stone-700 flex-1 truncate font-mono text-left">
                {pixKey}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 text-stone-400 hover:text-stone-900 transition-colors"
              >
                {copied ? (
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Link direto */}
        {pixLink && (
          <a
            href={pixLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold transition-colors mb-3"
          >
            Abrir link de pagamento
          </a>
        )}

        <p className="text-xs text-stone-400 leading-relaxed">
          Abra o app do seu banco, escaneie o QR Code ou cole a chave PIX para finalizar.
        </p>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 border-b border-stone-100" />
      <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="aspect-square bg-stone-100 rounded-3xl animate-pulse" />
        <div className="space-y-5 pt-2">
          <div className="h-3 bg-stone-100 rounded w-24 animate-pulse" />
          <div className="h-8 bg-stone-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-stone-100 rounded w-3/4 animate-pulse" />
          <div className="h-20 bg-stone-100 rounded-2xl animate-pulse mt-4" />
          <div className="h-12 bg-stone-100 rounded-xl animate-pulse" />
          <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function ProductPage() {
  const params    = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const [showPixModal, setShowPixModal] = useState(false);

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-stone-500">Produto não encontrado.</p>
          <Link href="/vitrine">
            <button className="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-stone-800">Produto não disponível</h2>
          <p className="text-stone-500 text-sm">Este produto não está mais disponível na vitrine.</p>
          <Link href="/vitrine">
            <button className="mt-4 px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors">
              ← Voltar ao catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const p = productQuery.data;
  const catLabel = p.categoryLabel || CATEGORY_META[p.category] || p.category;
  const inStock  = (p.stockQuantity ?? 0) > 0;
  const isLowStock = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  // Preços
  const pixPrice    = (p.suggestedPricePix    ?? 0) > 0 ? (p.suggestedPricePix    as number) : null;
  const cardPrice   = (p.suggestedPriceCard   ?? 0) > 0 ? (p.suggestedPriceCard   as number) : null;
  const boletoPrice = (p.suggestedPriceBoleto ?? 0) > 0 ? (p.suggestedPriceBoleto as number) : null;

  const cardInstallments = Math.max(1, Math.round((p as any).cardInstallments ?? 3));
  const boletoMonths     = Math.max(1, Math.round((p as any).boletoMonths     ?? 3));

  const hasPaymentLink = !!(p.pixLink || p.pixKey || p.cardPaymentUrl || p.boletoUrl);
  const hasPixPayment  = !!(p.pixLink || p.pixKey);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/vitrine">
            <button className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Catálogo</span>
            </button>
          </Link>
          <span className="font-black text-stone-900 tracking-widest text-base">PERMUPAY</span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-stone-400 hover:text-stone-800 text-sm transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Compartilhar</span>
          </button>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">

          {/* ── IMAGEM — NÃO CORTADA ──────────────────────────────────── */}
          <div className="relative">
            <div
              className="rounded-3xl overflow-hidden bg-stone-50"
              style={{ aspectRatio: "1 / 1" }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-contain p-6"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-9xl opacity-10 select-none">✨</span>
                </div>
              )}
            </div>

            {/* Badges */}
            {p.promoTag && inStock && (
              <span className="absolute top-4 left-4 bg-stone-900 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                {p.promoTag}
              </span>
            )}
            {!inStock && (
              <div className="absolute inset-0 bg-white/70 rounded-3xl flex items-center justify-center">
                <span className="bg-stone-700 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-lg">
                  Indisponível
                </span>
              </div>
            )}
            {isLowStock && inStock && (
              <span className="absolute bottom-4 left-4 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                Últimas unidades
              </span>
            )}
          </div>

          {/* ── DETALHES ──────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Categoria */}
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              {catLabel}
            </p>

            {/* Nome */}
            <h1 className="text-3xl font-bold text-stone-900 leading-tight -mt-3">
              {p.name}
            </h1>

            {/* Descrição curta */}
            {p.shortDescription && (
              <p className="text-stone-500 text-sm leading-relaxed -mt-2">
                {p.shortDescription}
              </p>
            )}

            {/* ── BLOCO DE PREÇOS ─────────────────────────────────── */}
            {inStock && (pixPrice || cardPrice || boletoPrice) ? (
              <div className="space-y-3 py-1">
                {/* PIX — destaque máximo */}
                {pixPrice && (
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-black text-stone-900 tracking-tight">
                      {fmt(pixPrice)}
                    </span>
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      no PIX
                    </span>
                  </div>
                )}

                {/* Cartão: "3x de" pequeno + parcela grande */}
                {cardPrice && (
                  <div className="flex items-baseline gap-1.5">
                    {pixPrice && <span className="text-xs text-stone-400">ou</span>}
                    {cardInstallments > 1 ? (
                      <>
                        <span className="text-sm text-stone-400">{cardInstallments}x de</span>
                        <span className="text-xl font-bold text-stone-800">
                          {fmt(cardPrice / cardInstallments)}
                        </span>
                        <span className="text-sm text-stone-400">no cartão</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-stone-800">{fmt(cardPrice)}</span>
                        <span className="text-sm text-stone-400">no cartão</span>
                      </>
                    )}
                  </div>
                )}

                {/* Boleto: "Xx de" pequeno + parcela grande */}
                {boletoPrice && (
                  <div className="flex items-baseline gap-1.5">
                    {(pixPrice || cardPrice) && <span className="text-xs text-stone-400">ou</span>}
                    {boletoMonths > 1 ? (
                      <>
                        <span className="text-sm text-stone-400">{boletoMonths}x de</span>
                        <span className="text-lg font-semibold text-stone-700">
                          {fmt(boletoPrice / boletoMonths)}
                        </span>
                        <span className="text-sm text-stone-400">no boleto</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-semibold text-stone-700">{fmt(boletoPrice)}</span>
                        <span className="text-sm text-stone-400">no boleto</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : inStock ? (
              <p className="text-stone-400 italic text-sm">Consulte o preço</p>
            ) : null}

            {/* Separador */}
            <div className="border-t border-stone-100" />

            {/* ── BOTÕES DE PAGAMENTO ─────────────────────────────── */}
            {inStock ? (
              <div className="space-y-3">
                {/* PIX — abre modal com QR Code */}
                {hasPixPayment && (
                  <button
                    onClick={() => setShowPixModal(true)}
                    className="w-full flex items-center justify-between gap-2 py-3.5 px-5 rounded-2xl bg-stone-900 hover:bg-stone-700 text-white font-semibold text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <QrCode className="w-4 h-4" />
                      </div>
                      Pagar com PIX
                    </span>
                    {pixPrice && (
                      <span className="text-stone-300 text-sm font-bold">{fmt(pixPrice)}</span>
                    )}
                  </button>
                )}

                {/* Cartão */}
                {p.cardPaymentUrl && (
                  <a
                    href={p.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3.5 px-5 rounded-2xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-800 font-semibold text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-stone-600" />
                      </div>
                      Pagar com Cartão
                    </span>
                    {cardPrice && cardInstallments > 1 ? (
                      <span className="text-stone-400 text-xs">
                        {cardInstallments}x de {fmt(cardPrice / cardInstallments)}
                      </span>
                    ) : cardPrice ? (
                      <span className="text-stone-400 text-xs">{fmt(cardPrice)}</span>
                    ) : null}
                  </a>
                )}

                {/* Boleto */}
                {p.boletoUrl && (
                  <a
                    href={p.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3.5 px-5 rounded-2xl border border-stone-100 hover:border-stone-300 text-stone-500 font-medium text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-stone-400" />
                      </div>
                      Gerar Boleto
                    </span>
                    {boletoPrice && boletoMonths > 1 ? (
                      <span className="text-stone-400 text-xs">
                        {boletoMonths}x de {fmt(boletoPrice / boletoMonths)}
                      </span>
                    ) : boletoPrice ? (
                      <span className="text-stone-400 text-xs">{fmt(boletoPrice)}</span>
                    ) : null}
                  </a>
                )}

                {/* Sem link de pagamento */}
                {!hasPaymentLink && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-stone-400 text-sm">
                  Este produto está temporariamente indisponível.
                </p>
                <Link href="/desejos">
                  <button className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl border-2 border-dashed border-stone-200 hover:border-stone-400 hover:text-stone-700 text-stone-400 font-medium text-sm transition-colors">
                    <Heart className="w-4 h-4" />
                    Avisar quando chegar
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── DESCRIÇÃO COMPLETA ──────────────────────────────────────── */}
        {p.description && (
          <div className="mt-16 max-w-2xl border-t border-stone-100 pt-12">
            <h2 className="text-base font-semibold text-stone-800 mb-4">Sobre o produto</h2>
            <div className="text-stone-500 text-sm leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>
        )}

        {/* ── VOLTAR ──────────────────────────────────────────────────── */}
        <div className="mt-14 pt-8 border-t border-stone-100">
          <Link href="/vitrine">
            <button className="flex items-center gap-2 text-stone-400 hover:text-stone-800 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t border-stone-100">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-4">
            <Link href="/vitrine">
              <span className="hover:text-stone-700 transition-colors cursor-pointer">Catálogo</span>
            </Link>
            <Link href="/desejos">
              <span className="hover:text-stone-700 transition-colors cursor-pointer">
                Lista de Desejos
              </span>
            </Link>
          </div>
          <span>© {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.</span>
        </div>
      </footer>

      {/* ── MODAL PIX ───────────────────────────────────────────────────── */}
      {showPixModal && (
        <PixModal
          pixKey={p.pixKey ?? null}
          pixLink={p.pixLink ?? null}
          price={pixPrice}
          productName={p.name}
          onClose={() => setShowPixModal(false)}
        />
      )}
    </div>
  );
}
