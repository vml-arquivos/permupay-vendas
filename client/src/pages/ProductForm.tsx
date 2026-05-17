/**
 * ProductForm.tsx — Cadastro + Simulador "Dark Luxury"
 * Inputs limpos sobre fundo negro, motor de cálculo lateral.
 * Matemática financeira intacta e lógica tRPC mantida.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Category = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";
type MarginMode = "PERCENT" | "VALUE";

const defaultForm = {
  name: "", category: "PERFUME" as Category, notes: "", costCurrency: "BRL" as "BRL"|"USD",
  costPrice: "", costPriceUsd: "", usdExchangeRate: "5.50",
  packagingCost: "0", inboundShippingCost: "0", operationalCost: "0",
  marginMode: "PERCENT" as MarginMode, desiredMarginRate: "30", desiredMarginValue: "200",
  taxRegime: "SIMPLES_NACIONAL", estimatedTaxRate: "6",
  boletoFixedFee: "3.50", boletoFeeRate: "0", boletoMonths: "3", boletoMonthlyRate: "2.99", boletoCustomerPaysInterest: false,
  cardDebitFeeRate: "1.99", cardUpfrontFeeRate: "4.99", cardInstallmentFeeRate: "5.49", cardAnticipationFeeRate: "1.99", cardInstallments: "12", cardMonthlyRate: "2.99", cardCustomerPaysInterest: false,
  stockQuantity: "0", minimumStock: "0", sellingPriceManual: "", pixLink: "", cardLink: "", promoTag: "", imageUrl: "", published: true
};

const parseNum = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; };
const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function ProductForm({ id }: { id?: number }) {
  const [, nav] = useLocation();
  const utils = trpc.useUtils();
  const isEdit = !!id;
  const { data, isLoading } = trpc.products.byId.useQuery({ id: id! }, { enabled: isEdit });
  const [f, setF] = useState(defaultForm);
  const [tab, setTab] = useState<"basics" | "costs" | "gateways">("basics");

  useEffect(() => {
    if (data) setF(prev => ({ ...prev, ...data, costPrice: String(data.costPrice || ""), desiredMarginRate: String(data.desiredMarginRate || "30") }));
  }, [data]);

  const create = trpc.products.create.useMutation({ onSuccess: () => { toast.success("Ativo registrado."); utils.products.list.invalidate(); nav("/produtos"); } });
  const update = trpc.products.update.useMutation({ onSuccess: () => { toast.success("Ativo atualizado."); utils.products.list.invalidate(); nav("/produtos"); } });

  const setStr = (k: keyof typeof defaultForm) => (v: string) => setF(prev => ({ ...prev, [k]: v }));

  // CÁLCULO REVERSO (ENGINE FINANCEIRO)
  const totalCost = useMemo(() => {
    const base = f.costCurrency === "USD" ? parseNum(f.costPriceUsd) * parseNum(f.usdExchangeRate) : parseNum(f.costPrice);
    return base + parseNum(f.packagingCost) + parseNum(f.inboundShippingCost) + parseNum(f.operationalCost);
  }, [f]);

  const sim = useMemo(() => {
    const tax = parseNum(f.estimatedTaxRate) / 100;
    const marginTarget = f.marginMode === "PERCENT" ? totalCost * (parseNum(f.desiredMarginRate) / 100) : parseNum(f.desiredMarginValue);

    const calcInverse = (feePerc: number, fixedFee: number = 0, clientPaysInt: boolean = false, totalIntRate: number = 0) => {
      let basePrice = (totalCost + marginTarget + fixedFee) / (1 - tax - (feePerc / 100));
      if (!clientPaysInt && totalIntRate > 0) basePrice *= (1 + (totalIntRate / 100));
      const finalPrice = parseNum(f.sellingPriceManual) > 0 ? parseNum(f.sellingPriceManual) : basePrice;
      const netProfit = finalPrice - totalCost - (finalPrice * (feePerc / 100) + fixedFee) - (finalPrice * tax);
      return { suggestedPrice: basePrice, finalPrice, netProfit };
    };

    return {
      pix: calcInverse(0.99),
      boleto: calcInverse(parseNum(f.boletoFeeRate), parseNum(f.boletoFixedFee), f.boletoCustomerPaysInterest, parseNum(f.boletoMonthlyRate) * parseNum(f.boletoMonths)),
      card: calcInverse(parseNum(f.cardInstallmentFeeRate) + parseNum(f.cardAnticipationFeeRate), 0, f.cardCustomerPaysInterest, parseNum(f.cardMonthlyRate) * parseNum(f.cardInstallments))
    };
  }, [f, totalCost]);

  const handleSave = () => {
    if (!f.name.trim()) return toast.error("Nome obrigatório.");
    const payload = { ...f, costPrice: parseNum(f.costPrice), desiredMarginRate: parseNum(f.desiredMarginRate), desiredMarginValue: parseNum(f.desiredMarginValue), sellingPrice: parseNum(f.sellingPriceManual) || sim.pix.suggestedPrice };
    isEdit ? update.mutate({ id: id!, data: payload as any }) : create.mutate(payload as any);
  };

  if (isEdit && isLoading) return <div className="p-12 text-center font-serif text-[#D4AF37]">Acessando acervo...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 bg-[#0A0A0A] text-white">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-white">{isEdit ? "Editar Ativo" : "Novo Ativo"}</h1>
          <p className="text-xs tracking-[0.15em] uppercase text-[#D4AF37] mt-2">Configuração de Catálogo e Inteligência de Margem</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
        
        {/* Esquerda: Setup Limpo (Dark Mode) */}
        <div className="space-y-8">
          <div className="flex gap-4 border-b border-white/10">
            <button onClick={() => setTab("basics")} className={`pb-3 text-xs font-bold uppercase tracking-wider ${tab === "basics" ? "border-b-2 border-[#D4AF37] text-[#D4AF37]" : "text-neutral-500"}`}>Identidade</button>
            <button onClick={() => setTab("costs")} className={`pb-3 text-xs font-bold uppercase tracking-wider ${tab === "costs" ? "border-b-2 border-[#D4AF37] text-[#D4AF37]" : "text-neutral-500"}`}>Custos</button>
            <button onClick={() => setTab("gateways")} className={`pb-3 text-xs font-bold uppercase tracking-wider ${tab === "gateways" ? "border-b-2 border-[#D4AF37] text-[#D4AF37]" : "text-neutral-500"}`}>Financeiro</button>
          </div>

          <div className="bg-[#141414] p-8 border border-white/5 shadow-2xl rounded-sm">
            {tab === "basics" && (
              <div className="space-y-6">
                <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Nome do Ativo</label><Input className="mt-2 h-12 text-lg font-serif bg-[#0A0A0A] border-white/10 text-white placeholder:text-neutral-700" placeholder="Ex: iPhone 15 Pro Max" value={f.name} onChange={e => setStr("name")(e.target.value)}/></div>
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">URL da Imagem</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" value={f.imageUrl} onChange={e => setStr("imageUrl")(e.target.value)}/></div>
                  <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Tag Promocional</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" value={f.promoTag} onChange={e => setStr("promoTag")(e.target.value)}/></div>
                  <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Link Pix</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" value={f.pixLink} onChange={e => setStr("pixLink")(e.target.value)}/></div>
                  <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Link Cartão</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" value={f.cardLink} onChange={e => setStr("cardLink")(e.target.value)}/></div>
                </div>
              </div>
            )}
            
            {tab === "costs" && (
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex gap-4"><label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300"><input type="radio" checked={f.costCurrency==="BRL"} onChange={()=>setStr("costCurrency")("BRL")} className="accent-[#D4AF37]"/> Real (BRL)</label><label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300"><input type="radio" checked={f.costCurrency==="USD"} onChange={()=>setStr("costCurrency")("USD")} className="accent-[#D4AF37]"/> Dólar (USD)</label></div>
                {f.costCurrency === "USD" ? (
                  <><div className="col-span-2"><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Custo Dólar</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" value={f.costPriceUsd} onChange={e=>setStr("costPriceUsd")(e.target.value)}/></div></>
                ) : (
                  <div className="col-span-2"><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Custo Real (R$)</label><Input className="mt-2 h-12 text-lg font-serif bg-[#0A0A0A] border-white/10 text-white" placeholder="0.00" value={f.costPrice} onChange={e=>setStr("costPrice")(e.target.value)}/></div>
                )}
                <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Embalagem</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" placeholder="0" value={f.packagingCost} onChange={e=>setStr("packagingCost")(e.target.value)}/></div>
                <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Frete</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" placeholder="0" value={f.inboundShippingCost} onChange={e=>setStr("inboundShippingCost")(e.target.value)}/></div>
              </div>
            )}

            {tab === "gateways" && (
              <div className="space-y-8">
                <div><label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Imposto Simples (%)</label><Input className="mt-2 bg-[#0A0A0A] border-white/10 text-white" placeholder="6" value={f.estimatedTaxRate} onChange={e=>setStr("estimatedTaxRate")(e.target.value)}/></div>
                <div className="pt-6 border-t border-white/10"><h4 className="text-xs font-bold uppercase mb-4 text-[#D4AF37]">Taxas de Cartão</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="text-[9px] font-bold text-neutral-500 uppercase">Taxa Parc (%)</label><Input className="mt-1 bg-[#0A0A0A] border-white/10 text-white" placeholder="0" value={f.cardInstallmentFeeRate} onChange={e=>setStr("cardInstallmentFeeRate")(e.target.value)}/></div>
                    <div><label className="text-[9px] font-bold text-neutral-500 uppercase">Antecipação (%)</label><Input className="mt-1 bg-[#0A0A0A] border-white/10 text-white" placeholder="0" value={f.cardAnticipationFeeRate} onChange={e=>setStr("cardAnticipationFeeRate")(e.target.value)}/></div>
                    <div><label className="text-[9px] font-bold text-neutral-500 uppercase">Máx Parc</label><Input className="mt-1 bg-[#0A0A0A] border-white/10 text-white" placeholder="12" value={f.cardInstallments} onChange={e=>setStr("cardInstallments")(e.target.value)}/></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Direita: Simulador Financeiro (Sticky Dark Dashboard) */}
        <div>
          <div className="bg-[#111] text-white border border-white/10 rounded-sm p-8 sticky top-28 shadow-2xl">
            <h3 className="font-serif text-2xl text-[#D4AF37] mb-6 flex items-center gap-3"><Calculator className="w-5 h-5"/> Motor de Lucro</h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-3">Definir Margem Alvo Livre</label>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setStr("marginMode")("PERCENT")} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider border border-white/10 ${f.marginMode === "PERCENT" ? "bg-[#D4AF37] text-black" : "text-neutral-500 hover:text-white"}`}>Porcentagem</button>
                  <button onClick={() => setStr("marginMode")("VALUE")} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider border border-white/10 ${f.marginMode === "VALUE" ? "bg-[#D4AF37] text-black" : "text-neutral-500 hover:text-white"}`}>Valor Bruto</button>
                </div>
                {f.marginMode === "PERCENT" ? (
                  <Input type="number" className="bg-[#0A0A0A] border-white/10 text-2xl h-14 text-center font-serif text-white focus:border-[#D4AF37]" placeholder="0" value={f.desiredMarginRate} onChange={e=>setStr("desiredMarginRate")(e.target.value)}/>
                ) : (
                  <Input type="number" className="bg-[#0A0A0A] border-white/10 text-2xl h-14 text-center font-serif text-white focus:border-[#D4AF37]" placeholder="0" value={f.desiredMarginValue} onChange={e=>setStr("desiredMarginValue")(e.target.value)}/>
                )}
              </div>

              <div className="border-t border-white/10 pt-6 space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-400">Pix Sugerido</span>
                  <div className="text-right"><span className="block text-2xl font-serif text-white">{formatBRL(sim.pix.suggestedPrice)}</span><span className="text-[9px] text-[#D4AF37] uppercase tracking-wider">Livre P/ Você: {formatBRL(sim.pix.netProfit)}</span></div>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-400">Cartão ({f.cardInstallments}x)</span>
                  <div className="text-right"><span className="block text-xl font-serif text-neutral-400">{formatBRL(sim.card.suggestedPrice)}</span><span className="text-[9px] text-[#D4AF37] uppercase tracking-wider">Livre P/ Você: {formatBRL(sim.card.netProfit)}</span></div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 text-center">Arredondar Vitrine Manualmente</label>
                <Input type="number" className="bg-[#0A0A0A] border-white/10 focus:border-[#D4AF37] text-center text-xl text-[#D4AF37] h-12 placeholder:text-neutral-800" placeholder={sim.pix.suggestedPrice.toFixed(2)} value={f.sellingPriceManual} onChange={e => setStr("sellingPriceManual")(e.target.value)} />
              </div>

              <button onClick={handleSave} className="w-full mt-8 bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold text-xs uppercase tracking-widest py-4 transition-colors">
                Publicar no Catálogo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
