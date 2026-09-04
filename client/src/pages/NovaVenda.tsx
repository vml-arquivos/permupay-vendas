import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  CircleDollarSign,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function NovaVenda() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO"
  >("PIX");
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [sellerId, setSellerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lastSale, setLastSale] = useState<{
    id: number;
    total: number;
  } | null>(null);

  const customersQuery = trpc.customers.list.useQuery({
    search: customerSearch.trim() || undefined,
  });
  const productsQuery = trpc.products.list.useQuery();
  const sellersQuery = trpc.sellers.list.useQuery(undefined, {
    enabled: isAdmin,
  });

  const customers = customersQuery.data ?? [];
  const products = useMemo(() => {
    const rows = (productsQuery.data ?? []) as any[];
    const term = productSearch.trim().toLowerCase();
    return rows
      .filter(p => p.active !== false)
      .filter(p => (term ? p.name?.toLowerCase().includes(term) : true));
  }, [productsQuery.data, productSearch]);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedProduct = (products as any[]).find(p => p.id === productId);

  const createSale = trpc.orders.createDirectSale.useMutation({
    onSuccess: async result => {
      toast.success(
        markAsPaid
          ? "Venda registrada e paga com sucesso!"
          : "Venda registrada, aguardando pagamento."
      );
      setLastSale({ id: result.id, total: Number(result.totalPrice ?? 0) });
      setProductId(null);
      setQuantity("1");
      setUnitPrice("");
      setNotes("");
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.counts.invalidate(),
        utils.customers.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const selectProduct = (product: any) => {
    setProductId(product.id);
    setUnitPrice(String(Number(product.suggestedPrice ?? 0) || ""));
  };

  const handleSubmit = () => {
    if (!customerId) return toast.error("Selecione um cliente cadastrado.");
    if (!productId) return toast.error("Selecione um produto.");
    const qty = Math.max(1, Math.floor(Number(quantity || 1)));
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price <= 0)
      return toast.error("Informe um preço de venda válido.");

    createSale.mutate({
      customerId,
      productId,
      quantity: qty,
      unitPrice: price,
      paymentMethod,
      markAsPaid,
      sellerId:
        isAdmin && sellerId ? Number(sellerId) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nova Venda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre uma venda direta para um cliente já cadastrado —
            disponível para administradores e vendedores.
          </p>
        </div>

        {lastSale && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Venda #{lastSale.id} registrada — {fmt(lastSale.total)}.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-4 w-4" /> 1. Cliente
              </CardTitle>
              <CardDescription>
                Busque um cliente já cadastrado.{" "}
                <Link href="/clientes" className="text-primary underline">
                  Cadastrar novo cliente
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nome, contato ou CPF"
                  value={customerSearch}
                  onChange={event => setCustomerSearch(event.target.value)}
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {customersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : customers.length ? (
                  customers.map(customer => (
                    <button
                      type="button"
                      key={customer.id}
                      onClick={() => setCustomerId(customer.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        customerId === customer.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <span>
                        <span className="font-medium">{customer.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {customer.contact}
                        </span>
                      </span>
                      {customerId === customer.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </p>
                )}
              </div>
              {selectedCustomer && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                  Cliente selecionado:{" "}
                  <strong>{selectedCustomer.name}</strong> ·{" "}
                  <Badge variant="outline" className="ml-1">
                    {selectedCustomer.creditStatus}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> 2. Produto
              </CardTitle>
              <CardDescription>
                Selecione o produto e ajuste o preço, se necessário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar produto"
                  value={productSearch}
                  onChange={event => setProductSearch(event.target.value)}
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {productsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : products.length ? (
                  products.map((product: any) => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        productId === product.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 truncate">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Estoque: {Number(product.stockQuantity ?? 0)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" /> 3. Fechar venda
            </CardTitle>
            {selectedProduct && (
              <CardDescription>
                {selectedProduct.name} — custo final{" "}
                {fmt(
                  Number(
                    selectedProduct.finalUnitCostBrl ??
                      selectedProduct.averageCostBrl ??
                      0
                  )
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={event => setUnitPrice(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={event =>
                    setPaymentMethod(event.target.value as typeof paymentMethod)
                  }
                >
                  <option value="PIX">Pix</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CARTAO">Cartão</option>
                  <option value="BOLETO">Boleto</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={markAsPaid ? "PAGO" : "PENDENTE"}
                  onChange={event =>
                    setMarkAsPaid(event.target.value === "PAGO")
                  }
                >
                  <option value="PAGO">Pago agora</option>
                  <option value="PENDENTE">
                    Pendente (crediário/boleto)
                  </option>
                </select>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-2 sm:max-w-sm">
                <Label>Atribuir a um vendedor (comissão) — opcional</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={sellerId}
                  onChange={event => setSellerId(event.target.value)}
                >
                  <option value="">Venda direta (sem comissão)</option>
                  {(sellersQuery.data ?? [])
                    .filter((s: any) => s.active)
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Input
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Ex.: entrada combinada, parcelamento, etc."
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="lg"
                className="gap-2"
                onClick={handleSubmit}
                disabled={createSale.isPending}
              >
                <CircleDollarSign className="h-4 w-4" />{" "}
                {createSale.isPending ? "Registrando…" : "Registrar venda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
