import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingBag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (value: number) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

export default function VendaDireta() {
  const params = useParams<{ token?: string }>();
  const accessToken = params.token ? decodeURIComponent(params.token) : "";
  const catalogQuery = trpc.sellers.catalog.useQuery({ accessToken }, { enabled: !!accessToken });
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", paymentMethod: "PIX" as PaymentMethod, quantity: "1" });
  const [successOrderId, setSuccessOrderId] = useState<number | null>(null);
  const createOrder = trpc.sellers.createDirectOrder.useMutation({
    onSuccess: (order) => setSuccessOrderId(order.id),
    onError: (error) => toast.error(error.message),
  });
  const selectedProduct = catalogQuery.data?.products.find((product) => product.id === selectedProductId);

  if (!accessToken || catalogQuery.error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">Link de vendedor inválido</h1><p className="mt-2 text-sm text-muted-foreground">Solicite um novo link ao responsável pela loja.</p></div></div>;
  }

  if (catalogQuery.isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando catálogo...</div>;

  const submit = () => {
    if (!selectedProduct) return toast.error("Selecione um produto.");
    if (!form.name.trim() || !form.contact.trim()) return toast.error("Informe nome e contato.");
    const quantity = Math.max(1, Number(form.quantity) || 1);
    const unitPrice = Number(selectedProduct.suggestedPricePix || selectedProduct.suggestedPrice || 0);
    createOrder.mutate({
      referralCode: catalogQuery.data?.seller.referralCode,
      accessToken,
      productId: selectedProduct.id,
      quantity,
      unitPrice,
      markAsPaid: false,
      buyerName: form.name.trim(),
      buyerContact: form.contact.trim(),
      buyerContactType: form.contact.includes("@") ? "EMAIL" : "WHATSAPP",
      paymentMethod: form.paymentMethod,
    });
  };

  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-5xl space-y-6 p-6"><header className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs uppercase tracking-[0.24em] text-amber-200">Venda direta</p><h1 className="mt-2 text-3xl font-bold">{catalogQuery.data?.seller.name}</h1><p className="mt-2 text-sm text-slate-300">Catálogo exclusivo com atendimento pelo vendedor.</p></header><div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]"><section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Produtos disponíveis</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(catalogQuery.data?.products ?? []).map((product) => <button key={product.id} type="button" onClick={() => setSelectedProductId(product.id)} className={`rounded-xl border p-3 text-left transition ${selectedProductId === product.id ? "border-slate-950 ring-2 ring-slate-950/10" : "hover:border-slate-400"}`}><div className="flex gap-3"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" /> : <ShoppingBag className="h-7 w-7 text-slate-300" />}</div><div className="min-w-0"><p className="font-semibold">{product.name}</p><p className="mt-1 text-sm text-muted-foreground">{product.stockQuantity} un. disponíveis</p><p className="mt-2 font-bold">{fmt(Number(product.suggestedPricePix || product.suggestedPrice))}</p></div></div></button>)}</div>{!catalogQuery.data?.products.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto disponível para venda externa.</p>}</section><section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Registrar pedido</h2>{successOrderId ? <div className="mt-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h3 className="mt-3 text-xl font-semibold">Pedido reservado</h3><p className="mt-2 text-sm text-muted-foreground">Pedido #{successOrderId}. O vendedor entrará em contato para confirmar o pagamento.</p></div> : <div className="mt-4 space-y-3"><div className="rounded-lg bg-slate-50 p-3 text-sm">{selectedProduct ? <><span className="text-muted-foreground">Produto selecionado</span><strong className="mt-1 block">{selectedProduct.name}</strong></> : <span className="text-muted-foreground">Selecione um produto ao lado.</span>}</div><Input placeholder="Seu nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input placeholder="WhatsApp ou e-mail" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /><div className="grid grid-cols-2 gap-3"><Input type="number" min="1" placeholder="Quantidade" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}><option value="PIX">Pix</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO">Cartão</option><option value="BOLETO">Boleto</option></select></div><Button className="w-full" disabled={createOrder.isPending || !selectedProduct} onClick={submit}>Reservar produto</Button><p className="text-center text-xs text-muted-foreground">O preço é validado pelo servidor no momento da reserva.</p></div>}</section></div></div></main>;
}
