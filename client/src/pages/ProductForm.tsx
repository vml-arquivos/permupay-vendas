import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../../../shared/pricingCalculator";

type FormData = {
  name: string;
  category: "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";
  ncm: string;
  costPrice: number;
  packagingCost: number;
  inboundShippingCost: number;
  operationalCost: number;
  desiredMarginRate: number;
  taxRegime: "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "MANUAL";
  estimatedTaxRate: number;
  notes: string;
  active: boolean;
  costCurrency: "BRL" | "USD";
  costPriceUsd: number;
  usdExchangeRate: number;
  stockQuantity: number;
  minimumStock: number;
};

const initial: FormData = { 
  name: "", 
  category: "CELULAR", 
  ncm: "", 
  costPrice: 0, 
  packagingCost: 0, 
  inboundShippingCost: 0, 
  operationalCost: 0, 
  desiredMarginRate: 0, 
  taxRegime: "SIMPLES_NACIONAL", 
  estimatedTaxRate: 0, 
  notes: "", 
  active: true,
  costCurrency: "BRL",
  costPriceUsd: 0,
  usdExchangeRate: 0,
  stockQuantity: 0,
  minimumStock: 0,
};

export default function ProductForm({ id }: { id?: number }) {
  const [, nav] = useLocation();
  const utils = trpc.useUtils();
  const isEdit = !!id;
  const { data, isLoading } = trpc.products.byId.useQuery({ id: id! }, { enabled: isEdit });
  const [f, setF] = useState<FormData>(initial);

  useEffect(() => {
    if (data) setF({ ...initial, ...data, ncm: data.ncm ?? "", notes: data.notes ?? "" });
  }, [data]);

  const create = trpc.products.create.useMutation({
    onSuccess: async () => {
      await utils.products.list.invalidate();
      nav("/produtos");
    },
  });
  const update = trpc.products.update.useMutation({
    onSuccess: async () => {
      await utils.products.list.invalidate();
      if (id) await utils.products.byId.invalidate({ id });
      nav("/produtos");
    },
  });

  const err = useMemo(() => {
    if (!f.name.trim()) return "Nome obrigatório";
    if (!f.category) return "Categoria obrigatória";
    if (f.costPrice < 0) return "Custo não pode ser negativo";
    if (f.costCurrency === "USD") {
      if (f.costPriceUsd < 0) return "Preço em dólar não pode ser negativo";
      if (f.usdExchangeRate <= 0) return "Cotação do dólar deve ser maior que zero";
    }
    if (f.stockQuantity < 0) return "Estoque não pode ser negativo";
    if (f.minimumStock < 0) return "Estoque mínimo não pode ser negativo";
    return "";
  }, [f]);

  // Calcular custo em BRL
  const costPriceBrl = useMemo(() => {
    if (f.costCurrency === "USD") {
      return f.costPriceUsd * f.usdExchangeRate;
    }
    return f.costPrice;
  }, [f.costCurrency, f.costPrice, f.costPriceUsd, f.usdExchangeRate]);

  // Calcular custo final unitário
  const finalUnitCostBrl = useMemo(() => {
    return costPriceBrl + f.packagingCost + f.inboundShippingCost + f.operationalCost;
  }, [costPriceBrl, f.packagingCost, f.inboundShippingCost, f.operationalCost]);

  const setNum = (k: keyof FormData, v: string) => setF((prev) => ({ ...prev, [k]: Number.isFinite(Number(v)) ? Number(v) : 0 }));
  const save = () => {
    if (err) return alert(err);
    if (isEdit) update.mutate({ id: id!, data: f }); else create.mutate(f);
  };

  if (isEdit && isLoading) return <div className="p-6">Carregando...</div>;
  if (isEdit && !data) return <div className="p-6">Produto não encontrado.</div>;

  return <div className='p-6 space-y-4'>
    <h1>{isEdit ? 'Editar' : 'Novo'} Produto</h1>
    
    {/* Campos básicos */}
    <input className='border p-2 w-full' placeholder='Nome do Produto' value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
    <input className='border p-2 w-full' placeholder='NCM' value={f.ncm} onChange={e => setF({ ...f, ncm: e.target.value })} />
    
    {/* Seletor de moeda */}
    <div className='space-y-2'>
      <label className='block text-sm font-medium'>Moeda de Custo</label>
      <select className='border p-2 w-full' value={f.costCurrency} onChange={e => setF({ ...f, costCurrency: e.target.value as "BRL" | "USD" })}>
        <option value="BRL">Real (BRL)</option>
        <option value="USD">Dólar (USD)</option>
      </select>
    </div>

    {/* Campos de custo conforme moeda */}
    {f.costCurrency === "BRL" ? (
      <div className='space-y-2'>
        <label className='block text-sm font-medium'>Preço de Custo (BRL)</label>
        <input type="number" className='border p-2 w-full' placeholder='Preço de Custo em Reais' value={f.costPrice} onChange={e => setNum("costPrice", e.target.value)} />
      </div>
    ) : (
      <>
        <div className='space-y-2'>
          <label className='block text-sm font-medium'>Preço de Custo (USD)</label>
          <input type="number" className='border p-2 w-full' placeholder='Preço em Dólar' value={f.costPriceUsd} onChange={e => setNum("costPriceUsd", e.target.value)} />
        </div>
        <div className='space-y-2'>
          <label className='block text-sm font-medium'>Cotação do Dólar (Manual)</label>
          <input type="number" className='border p-2 w-full' placeholder='Cotação (ex: 5.25)' value={f.usdExchangeRate} onChange={e => setNum("usdExchangeRate", e.target.value)} />
        </div>
      </>
    )}

    {/* Mostrar custo convertido em BRL */}
    <div className='bg-blue-50 p-3 rounded border border-blue-200'>
      <p className='text-sm text-gray-600'>Custo em Real (BRL)</p>
      <p className='text-lg font-semibold text-blue-900'>{formatCurrency(costPriceBrl)}</p>
    </div>

    {/* Campos de custos adicionais */}
    {(["packagingCost", "inboundShippingCost", "operationalCost", "desiredMarginRate", "estimatedTaxRate"] as const).map(k => (
      <div key={k} className='space-y-2'>
        <label className='block text-sm font-medium'>
          {k === "packagingCost" ? "Custo de Embalagem" : 
           k === "inboundShippingCost" ? "Custo de Frete" :
           k === "operationalCost" ? "Custo Operacional" :
           k === "desiredMarginRate" ? "Margem Desejada (%)" :
           "Alíquota Estimada (%)"}
        </label>
        <input type="number" className='border p-2 w-full' value={f[k]} onChange={e => setNum(k, e.target.value)} />
      </div>
    ))}

    {/* Mostrar custo final unitário */}
    <div className='bg-green-50 p-3 rounded border border-green-200'>
      <p className='text-sm text-gray-600'>Custo Final Unitário (BRL)</p>
      <p className='text-lg font-semibold text-green-900'>{formatCurrency(finalUnitCostBrl)}</p>
    </div>

    {/* Campos de estoque */}
    <div className='space-y-2'>
      <label className='block text-sm font-medium'>Estoque Atual</label>
      <input type="number" className='border p-2 w-full' placeholder='Quantidade em Estoque' value={f.stockQuantity} onChange={e => setNum("stockQuantity", e.target.value)} />
    </div>

    <div className='space-y-2'>
      <label className='block text-sm font-medium'>Estoque Mínimo</label>
      <input type="number" className='border p-2 w-full' placeholder='Estoque Mínimo' value={f.minimumStock} onChange={e => setNum("minimumStock", e.target.value)} />
    </div>

    {/* Notas */}
    <textarea className='border p-2 w-full' placeholder='Notas' value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
    
    {/* Botão salvar */}
    <button onClick={save} className='border px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>Salvar Produto</button>
  </div>;
}
