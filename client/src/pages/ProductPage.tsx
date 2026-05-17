/**
 * ProductPage.tsx — Página individual de produto na vitrine pública
 *
 * Rota: /vitrine/:id
 * - Exibe detalhes completos do produto
 * - Botões de pagamento: PIX (copia-e-cola + QR Code), Cartão, Boleto
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
  Package,
  Tag,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBRL(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  CELULAR: { label: "Celulares", icon: "📱" },
  ELETRONICO: { label: "Eletrônicos", icon: "💻" },
  PERFUME: { label: "Perfumes", icon: "🌸" },
  OUTRO: { label: "Outros", icon: "🛍️" },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-4 bg-stone-200 rounded w-32 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-stone-200 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-3 bg-stone-200 rounded w-24 animate-pulse" />
            <div className="h-8 bg-stone-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-stone-200 rounded w-3/4 animate-pulse" />
            <div className="h-12 bg-stone-200 rounded w-1/2 animate-pulse" />
            <div className="h-12 bg-stone-200 rounded-xl animate-pulse" />
            <div className="h-10 bg-stone-200 rounded-xl animate-pulse" />
          </div>
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
    { enabled: !!productId }
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
      navigator.share({
        title: productQuery.data?.name ?? "Produto",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  if (!productId || isNaN(productId)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-stone-500 text-lg">Produto não encontrado.</p>
          <Link href="/">
            <Button variant="outline">← Voltar ao catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (productQuery.isLoading) return <ProductSkeleton />;

  if (!productQuery.data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-stone-800">Produto não disponível</h2>
          <p className="text-stone-500">Este produto não está mais disponível na vitrine.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">← Voltar ao catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  const p = productQuery.data;
  const catMeta = CATEGORY_META[p.category] ?? { label: p.category, icon: "🛍️" };
  const inStock = (p.stockQuantity ?? 0) > 0;
  const isLowStock = inStock && (p.stockQuantity ?? 0) <= (p.minimumStock ?? 2);

  // Preço principal (PIX tem prioridade)
  const mainPrice = p.suggestedPricePix ?? p.suggestedPriceCard ?? p.suggestedPriceBoleto ?? null;
  const hasPaymentLink = !!(p.pixLink || p.pixKey || p.cardPaymentUrl || p.boletoUrl);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <button className="flex items-center gap-2 text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Catálogo
            </button>
          </Link>
          <span className="font-bold text-stone-900 tracking-tight">PERMUPAY</span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-sm transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Imagem */}
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-sm">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-20">{catMeta.icon}</span>
                </div>
              )}
            </div>
            {/* Badges sobre a imagem */}
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
              <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Package className="w-3 h-3" />
                Últimas unidades
              </span>
            )}
          </div>

          {/* Detalhes */}
          <div className="space-y-5">
            {/* Categoria */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
                {p.categoryLabel || catMeta.label}
              </span>
              {p.promoTag && (
                <Badge variant="secondary" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {p.promoTag}
                </Badge>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-2xl font-bold text-stone-900 leading-tight">{p.name}</h1>

            {/* Descrição curta */}
            {p.shortDescription && (
              <p className="text-stone-600 text-sm leading-relaxed">{p.shortDescription}</p>
            )}

            {/* Preço */}
            {inStock && mainPrice && mainPrice > 0 ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-stone-900">{formatBRL(mainPrice)}</span>
                  {(p.pixLink || p.pixKey) && p.suggestedPricePix && (
                    <span className="text-sm text-emerald-600 font-semibold">no PIX</span>
                  )}
                </div>
                {p.suggestedPriceCard && p.suggestedPriceCard > 0 && p.suggestedPriceCard !== mainPrice && (
                  <p className="text-sm text-stone-400">
                    ou {formatBRL(p.suggestedPriceCard)} no cartão
                  </p>
                )}
                {p.suggestedPriceBoleto && p.suggestedPriceBoleto > 0 && p.suggestedPriceBoleto !== mainPrice && (
                  <p className="text-sm text-stone-400">
                    ou {formatBRL(p.suggestedPriceBoleto)} no boleto
                  </p>
                )}
              </div>
            ) : inStock ? (
              <p className="text-stone-400 italic text-sm">Consulte o preço</p>
            ) : null}

            {/* Botões de pagamento */}
            {inStock ? (
              <div className="space-y-3 pt-2">
                {/* PIX com copia-e-cola */}
                {p.pixLink && (
                  <a
                    href={p.pixLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-700 text-white font-semibold text-sm transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    Pagar com PIX
                  </a>
                )}
                {/* Chave PIX copia-e-cola (quando não tem link direto) */}
                {!p.pixLink && p.pixKey && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      <Zap className="w-3 h-3 inline mr-1 text-emerald-500" />
                      Pagar com PIX
                    </p>
                    <div className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                      <code className="text-xs text-stone-700 flex-1 truncate font-mono">
                        {p.pixKey}
                      </code>
                      <button
                        onClick={() => handleCopyPixKey(p.pixKey!)}
                        className="flex-shrink-0 text-stone-500 hover:text-stone-900 transition-colors"
                        title="Copiar chave PIX"
                      >
                        {copied ? (
                          <CheckCheck className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-stone-400">
                      Copie a chave e cole no seu app de banco
                    </p>
                  </div>
                )}

                {/* Cartão */}
                {p.cardPaymentUrl && (
                  <a
                    href={p.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-stone-800 font-semibold text-sm transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar com Cartão
                    {p.suggestedPriceCard && p.suggestedPriceCard > 0 && (
                      <span className="ml-auto text-stone-400 text-xs font-normal">
                        {formatBRL(p.suggestedPriceCard)}
                      </span>
                    )}
                  </a>
                )}

                {/* Boleto */}
                {p.boletoUrl && (
                  <a
                    href={p.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-stone-200 hover:border-stone-400 text-stone-600 font-medium text-sm transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Gerar Boleto
                    {p.suggestedPriceBoleto && p.suggestedPriceBoleto > 0 && (
                      <span className="ml-auto text-stone-400 text-xs font-normal">
                        {formatBRL(p.suggestedPriceBoleto)}
                      </span>
                    )}
                  </a>
                )}

                {/* Sem link de pagamento */}
                {!hasPaymentLink && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            ) : (
              /* Produto fora de estoque */
              <div className="space-y-3 pt-2">
                <p className="text-stone-500 text-sm">Este produto está temporariamente indisponível.</p>
                <Link href="/desejos">
                  <button className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:text-stone-700 text-stone-400 font-medium text-sm transition-colors">
                    <Heart className="w-4 h-4" />
                    Avisar quando chegar
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Descrição completa */}
        {p.description && (
          <div className="mt-12 max-w-2xl">
            <h2 className="text-base font-semibold text-stone-800 mb-3">Descrição</h2>
            <div className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>
        )}

        {/* Voltar ao catálogo */}
        <div className="mt-12 pt-8 border-t border-stone-200">
          <Link href="/">
            <button className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-stone-700 transition-colors">Catálogo</Link>
            <Link href="/desejos" className="hover:text-stone-700 transition-colors">Lista de Desejos</Link>
          </div>
          <span>© {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
