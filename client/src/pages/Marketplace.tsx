/**
 * Marketplace.tsx — Vitrine Pública "Dark Luxury"
 * Fundo negro absoluto, contraste dourado, CTAs minimalistas.
 * Mantém hooks tRPC e lógica originais.
 */
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, CreditCard, Package } from "lucide-react";

const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Marketplace() {
  const { data: products, isLoading, error } = trpc.marketplace.products.useQuery();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Header da Vitrine Pública */}
      <header className="border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-50 py-5">
        <div className="container max-w-6xl mx-auto px-6 flex items-center justify-center">
          <img src="/LOGO PERMUPAY2.png" alt="Shoop Permupay" className="h-8 object-contain" onError={(e) => { e.currentTarget.src = "/LOGO PERMUPAY.png"; }} />
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-6 py-16 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Acervo Exclusivo</h1>
          <p className="text-xs md:text-sm tracking-[0.2em] uppercase text-[#D4AF37] font-medium">Curadoria Privada de Alto Padrão</p>
        </div>

        {error && <div className="text-center py-12 text-sm text-neutral-500 font-medium">Acervo temporariamente indisponível.</div>}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[500px] w-full rounded-none bg-white/5" />)}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {products?.map((p: any) => {
            const hasStock = p.stockQuantity > 0;
            return (
              <div key={p.id} className="group flex flex-col bg-[#141414] border border-white/5 shadow-2xl hover:border-white/20 transition-all duration-500 rounded-sm overflow-hidden">
                
                {/* Imagem "Ghost Product" - Fundo grafite sutil */}
                <div className="relative aspect-[4/5] bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] overflow-hidden flex items-center justify-center p-8">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-in-out drop-shadow-2xl" loading="lazy" />
                  ) : (
                    <Package className="w-12 h-12 stroke-[1] text-neutral-700" />
                  )}

                  {p.promoTag && (
                    <span className="absolute top-4 left-4 bg-[#D4AF37] text-black font-bold text-[8px] uppercase tracking-[0.25em] px-3 py-1.5 shadow-sm">
                      {p.promoTag}
                    </span>
                  )}

                  {!hasStock && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white font-bold text-xs uppercase tracking-widest border border-white px-6 py-2">Esgotado</span>
                    </div>
                  )}
                </div>

                {/* Dados Editoriais */}
                <div className="p-8 flex flex-col flex-1">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2">{p.category}</span>
                  <h3 className="font-serif text-2xl text-white leading-snug mb-3">{p.name}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed min-h-[40px] font-light mb-6">{p.notes || "Item de colecionador. Curadoria exclusiva."}</p>
                  
                  <div className="mt-auto border-t border-white/10 pt-6">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-1">Condição Exclusiva Pix</span>
                    <span className="text-2xl font-serif text-[#D4AF37]">{formatBRL(p.sellingPrice)}</span>
                  </div>

                  {/* CTAs Sofisticados */}
                  {hasStock && (
                    <div className="grid grid-cols-2 gap-3 pt-6">
                      {p.pixLink && (
                        <a href={p.pixLink} target="_blank" rel="noreferrer" className="w-full h-11 bg-[#D4AF37] hover:bg-[#b5952f] text-black text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
                          <Sparkles className="w-3.5 h-3.5" /> PIX
                        </a>
                      )}
                      {p.cardLink && (
                        <a href={p.cardLink} target="_blank" rel="noreferrer" className="w-full h-11 bg-transparent border border-white/20 hover:border-white text-white text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
                          <CreditCard className="w-3.5 h-3.5" /> Cartão
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
