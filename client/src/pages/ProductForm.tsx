import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

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
};

const initial: FormData = { name: "", category: "CELULAR", ncm: "", costPrice: 0, packagingCost: 0, inboundShippingCost: 0, operationalCost: 0, desiredMarginRate: 0, taxRegime: "SIMPLES_NACIONAL", estimatedTaxRate: 0, notes: "", active: true };

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
    return "";
  }, [f]);

  const setNum = (k: keyof FormData, v: string) => setF((prev) => ({ ...prev, [k]: Number.isFinite(Number(v)) ? Number(v) : 0 }));
  const save = () => {
    if (err) return alert(err);
    if (isEdit) update.mutate({ id: id!, data: f }); else create.mutate(f);
  };

  if (isEdit && isLoading) return <div className="p-6">Carregando...</div>;
  if (isEdit && !data) return <div className="p-6">Produto não encontrado.</div>;

  return <div className='p-6 space-y-2'><h1>{isEdit ? 'Editar' : 'Novo'} Produto</h1>
    <input className='border p-2 w-full' placeholder='name' value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
    <input className='border p-2 w-full' placeholder='ncm' value={f.ncm} onChange={e => setF({ ...f, ncm: e.target.value })} />
    {(["costPrice", "packagingCost", "inboundShippingCost", "operationalCost", "desiredMarginRate", "estimatedTaxRate"] as const).map(k => (
      <input key={k} type="number" className='border p-2 w-full' placeholder={k} value={f[k]} onChange={e => setNum(k, e.target.value)} />
    ))}
    <textarea className='border p-2 w-full' placeholder='notes' value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
    <button onClick={save} className='border px-3 py-2'>Salvar Produto</button>
  </div>;
}
