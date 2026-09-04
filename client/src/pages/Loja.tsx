import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  CheckCircle2,
  ChevronDown,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { CustomerAuthPanel } from "@/components/CustomerAuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function Loja() {
  const params = useParams<{ referralCode?: string }>();
  const referralCode = params.referralCode?.toUpperCase() ?? "";
  const catalogQuery = trpc.sellers.publicCatalog.useQuery(
    { referralCode },
    { enabled: Boolean(referralCode) }
  );
  const utils = trpc.useUtils();
  const meQuery = trpc.customerAuth.me.useQuery();
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<{ ids: number[] } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  // Identidade (nome/contato) vem sempre da sessão do cliente — aqui só
  // ficam os dados de entrega opcionais.
  const [delivery, setDelivery] = useState({
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const checkout = trpc.customers.checkout.useMutation({
    onSuccess: result => {
      cart.clear();
      setSuccess({ ids: result.orders.map(order => order.id) });
      setCheckoutOpen(false);
      toast.success("Pedido registrado com sucesso");
    },
    onError: error => toast.error(error.message),
  });

  const submitCheckout = () => {
    checkout.mutate({
      referralCode,
      items: cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        paymentMethod,
      })),
      email: delivery.email.trim() || undefined,
      address: delivery.address.trim() || undefined,
      city: delivery.city.trim() || undefined,
      state: delivery.state.trim().toUpperCase() || undefined,
      zipCode: delivery.zipCode.trim() || undefined,
    });
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <p className="mt-5 text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Compra recebida
          </p>
          <h1 className="mt-2 text-2xl font-bold">Pedido registrado</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Os pedidos {success.ids.map(id => `#${id}`).join(", ")} foram
            registrados. O pagamento e a confirmação serão tratados pela equipe.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/minha-conta"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ver meus pedidos
            </Link>
            <Link
              href={`/loja/${encodeURIComponent(referralCode)}`}
              className="text-sm text-muted-foreground underline"
            >
              Continuar na loja
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (catalogQuery.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando loja…
      </div>
    );
  if (catalogQuery.error || !catalogQuery.data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Loja indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de catálogo é inválido ou está inativo.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-primary underline"
          >
            Voltar à vitrine
          </Link>
        </div>
      </div>
    );

  const products = catalogQuery.data.products;
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-7 sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-200">
              <Store className="h-4 w-4" /> Loja afiliada
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Loja de {catalogQuery.data.sellerName}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Escolha seus produtos e monte seu pedido.
            </p>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="relative gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <ShoppingBag className="h-4 w-4" /> Carrinho
                {cart.itemCount > 0 && (
                  <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-950">
                    {cart.itemCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Seu carrinho</SheetTitle>
                <SheetDescription>
                  {cart.itemCount
                    ? `${cart.itemCount} item(ns) selecionado(s)`
                    : "Adicione produtos para começar."}
                </SheetDescription>
              </SheetHeader>
              {cart.items.length ? (
                <>
                  <div className="flex-1 space-y-4 overflow-y-auto px-4">
                    {cart.items.map(item => (
                      <div
                        key={item.productId}
                        className="flex gap-3 border-b pb-4"
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {fmt(item.unitPrice * item.quantity)}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                cart.updateQuantity(
                                  item.productId,
                                  item.quantity - 1
                                )
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                cart.updateQuantity(
                                  item.productId,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto h-7 w-7 text-destructive"
                              onClick={() => cart.removeItem(item.productId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <SheetFooter className="border-t">
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Total estimado</span>
                      <span>{fmt(cart.total)}</span>
                    </div>
                    {checkoutOpen ? (
                      meQuery.isLoading ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Carregando…
                        </p>
                      ) : !meQuery.data ? (
                        <div className="space-y-3">
                          <CustomerAuthPanel
                            title="Entre ou crie sua conta para continuar"
                            description="Para finalizar o pedido nesta loja, entre com sua conta ou crie uma — protege seus dados e seu histórico de compras."
                            onSuccess={() => utils.customerAuth.me.invalidate()}
                          />
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setCheckoutOpen(false)}
                          >
                            Voltar ao carrinho
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                            Comprando como{" "}
                            <strong>{meQuery.data.name}</strong>{" "}
                            <span className="text-muted-foreground">
                              ({meQuery.data.contact})
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Forma de pagamento</Label>
                            <select
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={paymentMethod}
                              onChange={event =>
                                setPaymentMethod(
                                  event.target.value as PaymentMethod
                                )
                              }
                            >
                              <option value="PIX">Pix</option>
                              <option value="DINHEIRO">Dinheiro</option>
                              <option value="CARTAO">Cartão</option>
                              <option value="BOLETO">Boleto</option>
                            </select>
                          </div>
                          <details className="rounded-lg border p-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                              Dados de entrega (opcional) <ChevronDown className="h-4 w-4" />
                            </summary>
                            <div className="mt-3 space-y-3">
                              <Input
                                placeholder="E-mail (opcional)"
                                type="email"
                                value={delivery.email}
                                onChange={event =>
                                  setDelivery({
                                    ...delivery,
                                    email: event.target.value,
                                  })
                                }
                              />
                              <Input
                                placeholder="Endereço"
                                value={delivery.address}
                                onChange={event =>
                                  setDelivery({
                                    ...delivery,
                                    address: event.target.value,
                                  })
                                }
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Cidade"
                                  value={delivery.city}
                                  onChange={event =>
                                    setDelivery({
                                      ...delivery,
                                      city: event.target.value,
                                    })
                                  }
                                />
                                <Input
                                  placeholder="UF"
                                  maxLength={2}
                                  value={delivery.state}
                                  onChange={event =>
                                    setDelivery({
                                      ...delivery,
                                      state: event.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              </div>
                              <Input
                                placeholder="CEP"
                                value={delivery.zipCode}
                                onChange={event =>
                                  setDelivery({
                                    ...delivery,
                                    zipCode: event.target.value,
                                  })
                                }
                              />
                            </div>
                          </details>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setCheckoutOpen(false)}
                            >
                              Voltar
                            </Button>
                            <Button
                              onClick={submitCheckout}
                              disabled={checkout.isPending}
                            >
                              {checkout.isPending
                                ? "Registrando…"
                                : "Confirmar pedido"}
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setCheckoutOpen(true)}
                      >
                        Fechar pedido
                      </Button>
                    )}
                  </SheetFooter>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 opacity-30" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {products.length} produto(s) disponível(is)
            </p>
          </div>
          <Link
            href="/minha-conta"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground underline"
          >
            <UserRound className="h-4 w-4" /> Minha conta
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => {
            const price = Number(
              product.suggestedPricePix || product.suggestedPrice || 0
            );
            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-56 items-center justify-center bg-slate-50 p-4">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ShoppingBag className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <h2 className="font-semibold">{product.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {product.shortDescription ||
                        product.description ||
                        "Produto disponível para pedido."}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        A partir de
                      </p>
                      <p className="text-xl font-bold">{fmt(price)}</p>
                    </div>
                    <Button
                      onClick={() => {
                        cart.addItem({
                          productId: product.id,
                          name: product.name,
                          imageUrl: product.imageUrl,
                          unitPrice: price,
                        });
                        toast.success("Produto adicionado ao carrinho", {
                          duration: 1200,
                        });
                      }}
                      disabled={
                        price <= 0 || Number(product.stockQuantity) <= 0
                      }
                    >
                      {Number(product.stockQuantity) > 0
                        ? "Adicionar"
                        : "Sem estoque"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!products.length && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-muted-foreground">
            Nenhum produto publicado nesta loja.
          </div>
        )}
      </div>
    </main>
  );
}
