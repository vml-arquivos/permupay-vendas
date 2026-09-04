import { useEffect, useMemo, useState } from "react";
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
  Receipt,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { ReceiptModal, type ReceiptOrder } from "@/components/ReceiptModal";

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
  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

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

  // Métodos de pagamento habilitados pelo produto selecionado. Sem produto
  // selecionado (ou produto legado sem os campos), assume todos habilitados
  // — mesmo comportamento de antes desta configuração existir.
  const ALL_PAYMENT_METHODS: Array<{
    value: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
    label: string;
  }> = [
    { value: "PIX", label: "Pix" },
    { value: "DINHEIRO", label: "Dinheiro" },
    { value: "CARTAO", label: "Cartão" },
    { value: "BOLETO", label: "Boleto" },
  ];
  const availablePaymentMethods = useMemo(() => {
    if (!selectedProduct) return ALL_PAYMENT_METHODS;
    return ALL_PAYMENT_METHODS.filter(method => {
      if (method.value === "PIX") return selectedProduct.pixEnabled !== false;
      if (method.value === "CARTAO") return selectedProduct.cardEnabled !== false;
      if (method.value === "BOLETO") return selectedProduct.boletoEnabled !== false;
      if (method.value === "DINHEIRO") return selectedProduct.cashEnabled !== false;
      return true;
    });
  }, [selectedProduct]);

  // Se o produto selecionado desabilitar o método atualmente escolhido,
  // troca automaticamente para o primeiro método ainda disponível — evita
  // enviar ao servidor um método que será rejeitado.
  useEffect(() => {
    if (
      availablePaymentMethods.length > 0 &&
      !availablePaymentMethods.some(m => m.value === paymentMethod)
    ) {
      setPaymentMethod(availablePaymentMethods[0].value);
    }
  }, [availablePaymentMethods, paymentMethod]);

  const createSale = trpc.orders.createDirectSale.useMutation({
    onSuccess: async result => {
      toast.success(
        markAsPaid
          ? "Venda registrada e paga com sucesso!"
          : "Venda registrada, aguardando pagamento."
      );
      setLastSale({ id: result.id, total: Number(result.totalPrice ?? 0) });

      // Comprovante disponível imediatamente aqui também — antes, uma venda
      // fechada pela Nova Venda não tinha nenhuma forma de gerar/enviar o
      // comprovante ao cliente sem ir até a tela de Pedidos separadamente.
      if (markAsPaid && selectedProduct && selectedCustomer) {
        setReceiptOrder({
          id: result.id,
          buyerName: selectedCustomer.name,
          buyerContact: selectedCustomer.contact,
          productName: selectedProduct.name,
          productImageUrl: selectedProduct.imageUrl ?? null,
          quantity: Number(result.quantity ?? 1),
          unitPrice: Number(result.unitPrice ?? 0),
          totalPrice: Number(result.totalPrice ?? 0),
          paymentMethod: result.paymentMethod,
          confirmedAt: result.confirmedAt,
          adminNotes: result.adminNotes,
          customerId,
        });
        setShowReceipt(true);
      }

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
    if (!availablePaymentMethods.some(m => m.value === paymentMethod))
      return toast.error(
        "Este produto não aceita a forma de pagamento selecionada."
      );
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Venda #{lastSale.id} registrada — {fmt(lastSale.total)}.
            </div>
            {receiptOrder && receiptOrder.id === lastSale.id && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-emerald-300 bg-white"
                onClick={() => setShowReceipt(true)}
              >
                <Receipt className="h-4 w-4" /> Ver / enviar comprovante
              </Button>
            )}
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
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
                  value={paymentMethod}
                  disabled={availablePaymentMethods.length === 0}
                  onChange={event =>
                    setPaymentMethod(event.target.value as typeof paymentMethod)
                  }
                >
                  {availablePaymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                {selectedProduct && availablePaymentMethods.length === 0 && (
                  <p className="text-xs text-destructive">
                    Este produto não tem nenhuma forma de pagamento habilitada. Ajuste em Produtos → Editar.
                  </p>
                )}
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

      <ReceiptModal
        order={receiptOrder}
        open={showReceipt}
        onOpenChange={setShowReceipt}
      />
    </DashboardLayout>
  );
}
