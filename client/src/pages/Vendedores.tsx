import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ExternalLink, CheckCircle, Plus, Trash2, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";

const fmt = (value: number) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Vendedores() {
  const utils = trpc.useUtils();
  const sellersQuery = trpc.sellers.list.useQuery();
  const commissionsQuery = trpc.sellers.commissions.list.useQuery();
  const [form, setForm] = useState({ name: "", email: "", phone: "", referralCode: "", commissionRate: "5" });
  const [sellerFilter, setSellerFilter] = useState<string>("TODOS");

  const createSeller = trpc.sellers.create.useMutation({
    onSuccess: async () => {
      toast.success("Vendedor criado.");
      setForm({ name: "", email: "", phone: "", referralCode: "", commissionRate: "5" });
      await utils.sellers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateSeller = trpc.sellers.update.useMutation({
    onSuccess: () => utils.sellers.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const deleteSeller = trpc.sellers.delete.useMutation({
    onSuccess: async () => {
      toast.success("Vendedor removido.");
      await utils.sellers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const markPaid = trpc.sellers.commissions.markPaid.useMutation({
    onSuccess: async () => {
      toast.success("Comissão marcada como paga.");
      await utils.sellers.commissions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredCommissions = useMemo(() => {
    const rows = commissionsQuery.data ?? [];
    return sellerFilter === "TODOS" ? rows : rows.filter((row) => row.sellerId === Number(sellerFilter));
  }, [commissionsQuery.data, sellerFilter]);

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do vendedor.");
    createSeller.mutate({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      referralCode: form.referralCode.trim() || undefined,
      commissionRate: Number(form.commissionRate || 5),
      active: true,
    });
  };

  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/vendedor/${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link de vendedor copiado.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Links externos, atribuição de vendas e comissões auditáveis.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Novo vendedor</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-6">
            <Input className="md:col-span-2" placeholder="Nome completo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input placeholder="E-mail (opcional)" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input placeholder="Telefone (opcional)" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input placeholder="Token (opcional)" value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value.toUpperCase() })} />
            <div className="flex gap-2">
              <Input type="number" min="0" max="100" step="0.1" placeholder="Comissão %" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} />
              <Button onClick={handleCreate} disabled={createSeller.isPending}>Criar</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Vendedores cadastrados</CardTitle></CardHeader>
          <CardContent>
            {sellersQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : sellersQuery.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-3">Vendedor</th><th className="px-3 py-3">Token/link</th><th className="px-3 py-3">Comissão</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Ações</th></tr></thead>
                  <tbody>
                    {sellersQuery.data.map((seller) => (
                      <tr key={seller.id} className="border-b last:border-0">
                        <td className="px-3 py-3"><div className="font-medium">{seller.name}</div><div className="text-xs text-muted-foreground">{seller.email || seller.phone || "Sem contato"}</div></td>
                        <td className="px-3 py-3"><button className="font-mono text-xs text-primary hover:underline" onClick={() => copyLink(seller.referralCode)}>{seller.referralCode}</button></td>
                        <td className="px-3 py-3">{Number(seller.commissionRate).toLocaleString("pt-BR")}%</td>
                        <td className="px-3 py-3"><Badge variant={seller.active ? "secondary" : "outline"}>{seller.active ? "Ativo" : "Inativo"}</Badge></td>
                        <td className="px-3 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="gap-1" onClick={() => copyLink(seller.referralCode)}><Copy className="h-3.5 w-3.5" /> Link</Button><Button size="sm" variant="outline" onClick={() => updateSeller.mutate({ id: seller.id, active: !seller.active })}>{seller.active ? "Inativar" : "Ativar"}</Button><Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (window.confirm(`Remover ${seller.name}?`)) deleteSeller.mutate({ id: seller.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button><a href={`/vendedor/${encodeURIComponent(seller.referralCode)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /></a></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><WalletCards className="h-4 w-4" /> Comissões</CardTitle><select className="h-9 rounded-md border bg-background px-3 text-sm" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}><option value="TODOS">Todos os vendedores</option>{(sellersQuery.data ?? []).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></CardHeader>
          <CardContent>
            {filteredCommissions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-3">Pedido</th><th className="px-3 py-3">Vendedor</th><th className="px-3 py-3">Venda</th><th className="px-3 py-3">Comissão</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Ação</th></tr></thead><tbody>{filteredCommissions.map((commission) => <tr key={commission.id} className="border-b last:border-0"><td className="px-3 py-3 font-mono">#{commission.orderId}</td><td className="px-3 py-3">{commission.sellerName}<div className="font-mono text-xs text-muted-foreground">{commission.referralCode}</div></td><td className="px-3 py-3">{fmt(Number(commission.orderTotal))}</td><td className="px-3 py-3 font-semibold">{fmt(Number(commission.commissionValue))}<div className="text-xs text-muted-foreground">{Number(commission.commissionRate)}%</div></td><td className="px-3 py-3"><Badge variant={commission.status === "PAGO" ? "secondary" : "outline"}>{commission.status}</Badge></td><td className="px-3 py-3 text-right">{commission.status === "PENDENTE" && <Button size="sm" className="gap-1" onClick={() => markPaid.mutate({ id: commission.id })}><CheckCircle className="h-3.5 w-3.5" /> Marcar pago</Button>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Nenhuma comissão encontrada.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
