/**
 * ProductPage.tsx — Página individual de produto na vitrine pública
 * Layout REFATORADO — mesmo padrão premium do modelo de referência:
 * - Fundo creme (#f0ebe0)
 * - Header: logo centralizado, nav escura
 * - Imagem grande com borda arredondada, fundo creme
 * - Preços destacados, botões CTA no mesmo estilo do grid
 * - Footer consistente
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

function Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0ebe0" }}>
      <div className="h-14 border-b" style={{ borderColor: "#d8d0c0" }} />
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square rounded-2xl animate-pulse" style={{ backgroundColor: "#e0d8cc" }} />
        <div className="space-y-5">
          {[24, 32, 20, 64, 44, 40].map((h, i) => (
            <div key={i} className="rounded animate-pulse" style={{ height: h, backgroundColor: "#e0d8cc", width: i === 0 ? "6rem" : "100%" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

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

  const PANEL_URL = import.meta.env.VITE_PANEL_URL ?? "";

  if (!productId || isNaN(productId)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="text-center space-y-4">
          <p style={{ color: "#8a7a6a" }}>Produto não encontrado.</p>
          <Link href="/vitrine">
            <button className="px-4 py-2 border rounded-lg text-sm hover:opacity-80 transition-opacity" style={{ borderColor: "#c8b89a", color: "#3a2a1a" }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold" style={{ color: "#1a1a1a" }}>Produto não disponível</h2>
          <p className="text-sm" style={{ color: "#8a7a6a" }}>Este produto não está mais disponível na vitrine.</p>
          <Link href="/vitrine">
            <button className="mt-4 px-4 py-2 border rounded-lg text-sm hover:opacity-80 transition-opacity" style={{ borderColor: "#c8b89a", color: "#3a2a1a" }}>
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

  const pixPrice    = (p.suggestedPricePix    ?? 0) > 0 ? (p.suggestedPricePix    as number) : null;
  const cardPrice   = (p.suggestedPriceCard   ?? 0) > 0 ? (p.suggestedPriceCard   as number) : null;
  const boletoPrice = (p.suggestedPriceBoleto ?? 0) > 0 ? (p.suggestedPriceBoleto as number) : null;
  const mainPrice   = pixPrice ?? cardPrice ?? boletoPrice;

  const cardInstallments = Math.max(1, Math.round((p as any).cardInstallments ?? 3));
  const boletoMonths     = Math.max(1, Math.round((p as any).boletoMonths     ?? 3));

  const hasPaymentLink = !!(p.pixLink || p.pixKey || p.cardPaymentUrl || p.boletoUrl);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f0ebe0" }}>

      {/* HEADER */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: "#f0ebe0", borderBottom: "1px solid #d8d0c0" }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/vitrine">
            <button className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: "#8a7a6a" }}>
              <ArrowLeft className="w-4 h-4" />
              Catálogo
            </button>
          </Link>
          <Link href="/vitrine">
            <span className="font-black tracking-widest text-base cursor-pointer select-none" style={{ color: "#1a1a1a" }}>
              PERMUPAY
            </span>
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "#8a7a6a" }}
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Compartilhar</span>
          </button>
          <a
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-70"
            style={{ borderColor: "#c8b89a", color: "#5a4a3a" }}
          >
            Dashboard
          </a>
        </div>

        {/* Nav escura */}
        <nav style={{ backgroundColor: "#2a2218" }}>
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center justify-center gap-10 h-10">
              <Link href="/vitrine">
                <span className="text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: "#a89880" }}>Catálogo</span>
              </Link>
              <Link href="/desejos">
                <span className="text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: "#a89880" }}>Lista de Desejos</span>
              </Link>
              <a href={`${PANEL_URL}/login`} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: "#a89880" }}>
                Gerenciar
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

          {/* IMAGEM */}
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc" }}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-20 select-none">✨</span>
                </div>
              )}
            </div>
            {p.promoTag && inStock && (
              <span className="absolute top-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: "#c0392b" }}>
                {p.promoTag}
              </span>
            )}
            {!inStock && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(240,235,224,0.80)" }}>
                <span className="text-white text-sm font-semibold px-4 py-2 rounded-full" style={{ backgroundColor: "#3d3530" }}>
                  Indisponível
                </span>
              </div>
            )}
            {isLowStock && inStock && (
              <span className="absolute bottom-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#b8860b" }}>
                Últimas unidades
              </span>
            )}
          </div>

          {/* DETALHES */}
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8a7a6a" }}>
              {catLabel}
            </p>
            <h1 className="text-2xl font-bold leading-tight -mt-2" style={{ color: "#1a1a1a" }}>
              {p.name}
            </h1>
            {p.shortDescription && (
              <p className="text-sm leading-relaxed" style={{ color: "#7a6a5a" }}>
                {p.shortDescription}
              </p>
            )}

            {/* BLOCO DE PREÇOS */}
            {inStock && mainPrice ? (
              <div className="space-y-1.5 py-2">
                {pixPrice && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight" style={{ color: "#1a1a1a" }}>
                      {fmt(pixPrice)}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "#3d7a4a" }}>no PIX</span>
                  </div>
                )}
                {cardPrice && (
                  <p className="text-sm leading-relaxed" style={{ color: "#8a7a6a" }}>
                    {pixPrice ? "ou " : ""}
                    {cardInstallments > 1 ? (
                      <>
                        <span>{cardInstallments}x de </span>
                        <span className="font-bold text-lg" style={{ color: "#1a1a1a" }}>{fmt(cardPrice / cardInstallments)}</span>
                        <span> no cartão</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold" style={{ color: "#1a1a1a" }}>{fmt(cardPrice)}</span>
                        <span> no cartão</span>
                      </>
                    )}
                  </p>
                )}
                {boletoPrice && (
                  <p className="text-sm leading-relaxed" style={{ color: "#8a7a6a" }}>
                    {(pixPrice || cardPrice) ? "ou " : ""}
                    {boletoMonths > 1 ? (
                      <>
                        <span>{boletoMonths}x de </span>
                        <span className="font-semibold text-base" style={{ color: "#3a2a1a" }}>{fmt(boletoPrice / boletoMonths)}</span>
                        <span> no boleto</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium" style={{ color: "#3a2a1a" }}>{fmt(boletoPrice)}</span>
                        <span> no boleto</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : inStock ? (
              <p className="italic text-sm" style={{ color: "#8a7a6a" }}>Consulte o preço</p>
            ) : null}

            {/* BOTÕES DE PAGAMENTO */}
            {inStock ? (
              <div className="space-y-2.5 pt-1">
                {/* PIX com link */}
                {p.pixLink && (
                  <a
                    href={p.pixLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl font-bold text-sm hover:opacity-85 transition-opacity"
                    style={{ backgroundColor: "#c8b89a", color: "#1a1a1a" }}
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      CTA Pagar com PIX
                    </span>
                    {pixPrice && <span className="text-xs font-normal opacity-70">{fmt(pixPrice)}</span>}
                  </a>
                )}

                {/* PIX copia-e-cola */}
                {!p.pixLink && p.pixKey && (
                  <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#c8b89a", backgroundColor: "#fff" }}>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#3d7a4a" }} />
                      <p className="text-xs font-semibold" style={{ color: "#5a4a3a" }}>
                        Pagar com PIX
                        {pixPrice && <span className="ml-2 font-bold" style={{ color: "#1a1a1a" }}>{fmt(pixPrice)}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "#e0d8cc", backgroundColor: "#f5f0e8" }}>
                      <code className="text-xs flex-1 truncate font-mono" style={{ color: "#3a2a1a" }}>{p.pixKey}</code>
                      <button
                        onClick={() => handleCopyPixKey(p.pixKey!)}
                        className="flex-shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: "#8a7a6a" }}
                        title="Copiar chave PIX"
                      >
                        {copied ? <CheckCheck className="w-4 h-4" style={{ color: "#3d7a4a" }} /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: "#a89880" }}>Copie a chave e cole no seu app de banco</p>
                  </div>
                )}

                {/* Cartão */}
                {p.cardPaymentUrl && (
                  <a
                    href={p.cardPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl font-bold text-sm hover:opacity-85 transition-opacity"
                    style={{ backgroundColor: "#3d3530", color: "#fff" }}
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Pagar com Cartão
                    </span>
                    {cardPrice && cardInstallments > 1 ? (
                      <span className="text-xs font-normal opacity-70">{cardInstallments}x de {fmt(cardPrice / cardInstallments)}</span>
                    ) : cardPrice ? (
                      <span className="text-xs font-normal opacity-70">{fmt(cardPrice)}</span>
                    ) : null}
                  </a>
                )}

                {/* Boleto */}
                {p.boletoUrl && (
                  <a
                    href={p.boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 py-3 px-5 rounded-xl border font-medium text-sm hover:opacity-80 transition-opacity"
                    style={{ borderColor: "#c8b89a", color: "#3a2a1a", backgroundColor: "transparent" }}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Gerar Boleto
                    </span>
                    {boletoPrice && boletoMonths > 1 ? (
                      <span className="text-xs opacity-70">{boletoMonths}x de {fmt(boletoPrice / boletoMonths)}</span>
                    ) : boletoPrice ? (
                      <span className="text-xs opacity-70">{fmt(boletoPrice)}</span>
                    ) : null}
                  </a>
                )}

                {/* Sem links */}
                {!hasPaymentLink && (
                  <a
                    href="https://wa.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm hover:opacity-85 transition-opacity"
                    style={{ backgroundColor: "#3d7a4a", color: "#fff" }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Consultar via WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-sm" style={{ color: "#8a7a6a" }}>Este produto está temporariamente indisponível.</p>
                <Link href="/desejos">
                  <button className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-dashed font-medium text-sm hover:opacity-80 transition-opacity" style={{ borderColor: "#c8b89a", color: "#8a7a6a" }}>
                    <Heart className="w-4 h-4" />
                    Avisar quando chegar
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* DESCRIÇÃO COMPLETA */}
        {p.description && (
          <div className="mt-14 max-w-2xl border-t pt-10" style={{ borderColor: "#d8d0c0" }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: "#3a2a1a" }}>Descrição</h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#5a4a3a" }}>
              {p.description}
            </div>
          </div>
        )}

        {/* VOLTAR */}
        <div className="mt-12 pt-8 border-t" style={{ borderColor: "#d8d0c0" }}>
          <Link href="/vitrine">
            <button className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "#8a7a6a" }}>
              <ArrowLeft className="w-4 h-4" />
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-16 border-t" style={{ borderColor: "#d8d0c0", backgroundColor: "#f0ebe0" }}>
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "#a89880" }}>
          <div className="flex items-center gap-4">
            <Link href="/vitrine"><span className="hover:opacity-70 transition-opacity cursor-pointer">Catálogo</span></Link>
            <Link href="/desejos"><span className="hover:opacity-70 transition-opacity cursor-pointer">Lista de Desejos</span></Link>
          </div>
          <span>© {new Date().getFullYear()} Permupay Vendas. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
