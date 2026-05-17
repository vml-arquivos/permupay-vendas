/**
 * ProductPage.tsx — Página individual de produto na vitrine pública
 *
 * Rota: /vitrine/:id
 * Layout premium delicado:
 * - Header limpo com logo centralizado
 * - Imagem grande à esquerda
 * - Preços em destaque com parcelas calculadas (ex: "3x de R$ 216,50")
 * - Botões de pagamento discretos, não gigantes
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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 border-b border-stone-100" />
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square bg-stone-100 rounded-2xl animate-pulse" />
        <div className="space-y-5">
          <div className="h-3 bg-stone-100 rounded w-24 animate-pulse" />
          <div className="h-8 bg-stone-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-stone-100 rounded w-3/4 animate-pulse" />
          <div className="h-16 bg-stone-100 rounded animate-pulse" />
          <div className="h-11 bg-stone-100 rounded-xl animate-pulse" />
          <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function ProductPage() {
  const params = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const [copied, setCopied] = useState(false);

  const productQuery = trpc.marketplace.productById.useQuery(
    { id: productId! },
    { enabled: !!productId && !isNaN(productId!) }
  );

  const handleCopyPixKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

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
  const inStock = (p.stockQuantity ?? 0) > 0;
  const isLowStock = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  // Preços
  const pixPrice   = (p.suggestedPricePix    ?? 0) > 0 ? (p.suggestedPricePix    as number) : null;
  const cardPrice  = (p.suggestedPriceCard   ?? 0) > 0 ? (p.suggestedPriceCard   as number) : null;
  const boletoPrice = (p.suggestedPriceBoleto ?? 0) > 0 ? (p.suggestedPriceBoleto as number) : null;
  const mainPrice  = pixPrice ?? cardPrice ?? boletoPrice;

  const cardInstallments = Math.max(1, Math.round((p as any).cardInstallments ?? 3));
  const boletoMonths     = Math.max(1, Math.round((p as any).boletoMonths     ?? 3));

  const hasPaymentLink = !!(p.pixLink || p.pixKey || p.cardPaymentUrl || p.boletoUrl);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/vitrine">
            <button className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Catálogo
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
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

          {/* ── IMAGEM ────────────────────────────────────────────────── */}
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden bg-stone-50 border border-stone-100">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-10 select-none">✨</span>
                </div>
              )}
            </div>
            {p.promoTag && inStock && (
              <span className="absolute top-3 left-3 bg-stone-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                {p.promoTag}
              </span>
            )}
            {!inStock && (
              <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                <span className="bg-stone-700 text-white text-sm font-semibold px-4 py-2 rounded-full">
                  Indisponível
                </span>
              </div>
            )}
            {isLowStock && inStock && (
              <span className="absolute bottom-3 left-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                Últimas unidades
              </span>
            )}
          </div>

          {/* ── DETALHES ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Categoria */}
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              {catLabel}
            </p>

            {/* Nome */}
            <h1 className="text-2xl font-bold text-stone-900 leading-tight -mt-2">
              {p.name}
            </h1>

            {/* Descrição curta */}
            {p.shortDescription && (
              <p className="text-stone-500 text-sm leading-relaxed">
                {p.shortDescription}
              </p>
            )}

            {/* ── BLOCO DE PREÇOS ─────────────────────────────────── */}
            {inStock && mainPrice ? (
              <div className="space-y-1.5 py-2">
                {/* Preço PIX — destaque máximo */}
                {pixPrice && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-stone-900 tracking-tight">
                      {fmt(pixPrice)}
                    </span>
                    <span className="text-sm font-semibold text-emerald-600">no PIX</span>
                  </div>
                )}

                {/* Cartão com parcelas */}
                {cardPrice && (
                  <p className="text-sm text-stone-400 leading-relaxed">
                    {pixPrice ? "ou " : ""}
                    {cardInstallments > 1 ? (
                      <>
                        <span className="text-stone-400">{cardInstallments}x de </span>
                        <span className="text-stone-800 font-bold text-lg">
                          {fmt(cardPrice / cardInstallments)}
                        </span>
                        <span className="text-stone-400"> no cartão</span>
                      </>
                    ) : (
                      <>
                        <span className="text-stone-800 font-semibold">{fmt(cardPrice)}</span>
                        <span className="text-stone-400"> no cartão</span>
                      </>
                    )}
                    {!pixPrice && (
                      <span className="ml-1 text-xs text-stone-400">à vista</span>
                    )}
                  </p>
                )}

                {/* Boleto com parcelas */}
                {boletoPrice && (
                  <p className="text-sm text-stone-400 leading-relaxed">
                    {(pixPrice || cardPrice) ? "ou " : ""}
                    {boletoMonths > 1 ? (
                      <>
                        <span className="text-stone-400">{boletoMonths}x de </span>
                        <span className="text-stone-700 font-semibold text-base">
                          {fmt(boletoPrice / boletoMonths)}
                        </span>
                        <span className="text-stone-400"> no boleto</span>
                      </>
                    ) : (
                      <>
                        <span className="text-stone-700 font-medium">{fmt(boletoPrice)}</span>
                        <span className="text-stone-400"> no boleto</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : inStock ? (
              <p className="text-stone-400 italic text-sm">Consulte o preço</p>
            ) : null}

            {/* ── BOTÕES DE PAGAMENTO ─────────────────────────────── */}
            {inStock ? (
              <div className="space-y-2 pt-1">
                {/* PIX com link direto */}
                {p.pixLink && (
                  <a
                    href={p.pixLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl bg-stone-900 hover:bg-stone-700 text-white font-semibold text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Pagar com PIX
                    </span>
                    {pixPrice && (
                      <span className="text-stone-300 text-xs font-normal">{fmt(pixPrice)}</span>
                    )}
                  </a>
                )}

                {/* PIX copia-e-cola */}
                {!p.pixLink && p.pixKey && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs font-semibold text-stone-600">
                        Pagar com PIX
                        {pixPrice && (
                          <span className="ml-2 text-stone-900 font-bold">{fmt(pixPrice)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-stone-200 px-3 py-2">
                      <code className="text-xs text-stone-700 flex-1 truncate font-mono">
                        {p.pixKey}
                      </code>
                      <button
                        onClick={() => handleCopyPixKey(p.pixKey!)}
                        className="flex-shrink-0 text-stone-400 hover:text-stone-900 transition-colors"
                        title="Copiar chave PIX"
                      >
                        {copied ? (
                          <CheckCheck className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-stone-400">Copie a chave e cole no seu app de banco</p>
                  </div>
                )}

                {/* Cartão */}
                {p.cardPaymentUrl && (
                  <a
                    href={p.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl border border-stone-200 hover:border-stone-400 hover:bg-stone-50 text-stone-700 font-medium text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
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
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl border border-stone-100 hover:border-stone-300 text-stone-500 font-medium text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
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
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-stone-400 text-sm">Este produto está temporariamente indisponível.</p>
                <Link href="/desejos">
                  <button className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-400 hover:text-stone-700 text-stone-400 font-medium text-sm transition-colors">
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
          <div className="mt-14 max-w-2xl border-t border-stone-100 pt-10">
            <h2 className="text-base font-semibold text-stone-800 mb-4">Descrição</h2>
            <div className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>
        )}

        {/* ── VOLTAR ──────────────────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-stone-100">
          <Link href="/vitrine">
            <button className="flex items-center gap-2 text-stone-400 hover:text-stone-800 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-stone-100">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-4">
            <Link href="/vitrine">
              <span className="hover:text-stone-700 transition-colors cursor-pointer">Catálogo</span>
            </Link>
            <Link href="/desejos">
              <span className="hover:text-stone-700 transition-colors cursor-pointer">Lista de Desejos</span>
            </Link>
          </div>
          <span>© {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
