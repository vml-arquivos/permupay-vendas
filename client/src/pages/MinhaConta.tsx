import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  LogOut,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { getStoredReferralCode } from "@/lib/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  PAYMENT_LABEL,
  type OrderStatus,
} from "@/lib/orderStatus";
import {
  forgetRememberedContact,
  getRememberedContact,
  rememberContact,
} from "@/lib/customerSession";
import { formatTimeRemaining, isExpired } from "@shared/reservationExpiry";

type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
type UploadValue = { url: string; dataUrl: string; fileName: string; mimeType: string };

// Contato vindo do link (?contact=...) tem prioridade; sem isso, reconhece o
// cliente que já esteve aqui antes pelo contato lembrado neste navegador.
const initialContact = () => {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("contact");
  return fromUrl?.trim() || getRememberedContact();
};
const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function UploadSlot({
  label,
  value,
  busy,
  acceptLabel,
  onSelect,
}: {
  label: string;
  value: UploadValue | null;
  busy: boolean;
  acceptLabel: string;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{acceptLabel}</p>
        </div>
        {value ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>
      {value?.mimeType === "application/pdf" ? (
        <a
          className="mt-3 block truncate text-sm text-primary underline"
          href={value.dataUrl}
          target="_blank"
          rel="noreferrer"
        >
          {value.fileName}
        </a>
      ) : value ? (
        <img
          src={value.dataUrl}
          alt={label}
          className="mt-3 h-24 w-full rounded-lg bg-muted object-contain"
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full gap-2"
        onClick={onSelect}
        disabled={busy}
      >
        <Upload className="h-3.5 w-3.5" />{" "}
        {busy ? "Enviando…" : value ? "Trocar arquivo" : "Selecionar arquivo"}
      </Button>
    </div>
  );
}

export default function MinhaConta() {
  const cart = useCart();
  const [contact, setContact] = useState(initialContact);
  const [submittedContact, setSubmittedContact] = useState(initialContact);
  const identified = submittedContact.trim().length >= 5;
  const documentUpload = useDocumentUpload("clientes");
  const [activeTab, setActiveTab] = useState("pedidos");

  const profileQuery = trpc.customers.myProfile.useQuery(
    { contact: submittedContact },
    { enabled: identified }
  );
  const ordersQuery = trpc.customers.myOrders.useQuery(
    { contact: submittedContact },
    { enabled: identified }
  );
  const recommendationsQuery = trpc.customers.recommendations.useQuery(
    { contact: submittedContact, limit: 8 },
    { enabled: identified }
  );

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    cpf: "",
    rg: "",
    birthDate: "",
  });
  const [docFront, setDocFront] = useState<UploadValue | null>(null);
  const [docBack, setDocBack] = useState<UploadValue | null>(null);
  const [proofAddress, setProofAddress] = useState<UploadValue | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    const p = profileQuery.data;
    setProfileForm({
      name: p.name ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      zipCode: p.zipCode ?? "",
      cpf: p.cpf ?? "",
      rg: p.rg ?? "",
      birthDate: p.birthDate ? String(p.birthDate).slice(0, 10) : "",
    });
  }, [profileQuery.data]);

  const updateProfile = trpc.customers.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success(
        isNewCustomer
          ? "Conta criada com sucesso! Agora você já pode ver pedidos, recomendações e usar o carrinho."
          : "Cadastro atualizado com sucesso."
      );
      rememberContact(submittedContact);
      await profileQuery.refetch();
      if (isNewCustomer) setActiveTab("pedidos");
    },
    onError: error => toast.error(error.message),
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [checkoutSuccess, setCheckoutSuccess] = useState<number[] | null>(null);
  const checkout = trpc.customers.checkout.useMutation({
    onSuccess: async result => {
      cart.clear();
      setCheckoutSuccess(result.orders.map(o => o.id));
      toast.success("Pedido registrado com sucesso!");
      await ordersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const groups = useMemo(() => {
    const map = new Map<string, typeof ordersQuery.data>();
    for (const order of ordersQuery.data ?? []) {
      const key = order.checkoutGroupId || `pedido-${order.id}`;
      map.set(key, [...(map.get(key) ?? []), order]);
    }
    return [...map.entries()];
  }, [ordersQuery.data]);

  const totals = useMemo(() => {
    const rows = ordersQuery.data ?? [];
    const paid = rows.filter(o => o.status === "PAGO");
    return {
      count: rows.length,
      totalPaid: paid.reduce((acc, o) => acc + Number(o.totalPrice ?? 0), 0),
    };
  }, [ordersQuery.data]);

  const searchOrders = () => {
    const value = contact.trim();
    if (value.length < 5)
      return toast.error("Informe um WhatsApp ou e-mail válido.");
    setSubmittedContact(value);
    rememberContact(value);
  };

  const switchAccount = () => {
    forgetRememberedContact();
    setContact("");
    setSubmittedContact("");
    setActiveTab("pedidos");
  };

  // Cadastro completo/criação de conta reaproveita o mesmo updateProfile
  // (identifyOrCreateCustomer) usado para salvar o cadastro — é o mesmo
  // endpoint que já cria o cliente quando ele ainda não existe.
  const isNewCustomer =
    identified && profileQuery.isFetched && !profileQuery.isLoading && !profileQuery.data;

  const pendingOrders = useMemo(
    () =>
      (ordersQuery.data ?? []).filter(
        o => o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO"
      ),
    [ordersQuery.data]
  );
  const nearestExpiry = useMemo(() => {
    const sorted = [...pendingOrders].sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
    );
    return sorted[0]?.expiresAt ?? null;
  }, [pendingOrders]);

  const submitProfile = () => {
    if (!profileForm.name.trim())
      return toast.error("Informe seu nome completo.");
    updateProfile.mutate({
      name: profileForm.name.trim(),
      contact: submittedContact,
      contactType: submittedContact.includes("@") ? "EMAIL" : "WHATSAPP",
      email: profileForm.email.trim() || undefined,
      address: profileForm.address.trim() || undefined,
      city: profileForm.city.trim() || undefined,
      state: profileForm.state.trim() || undefined,
      zipCode: profileForm.zipCode.trim() || undefined,
      cpf: profileForm.cpf.trim() || undefined,
      rg: profileForm.rg.trim() || undefined,
      birthDate: profileForm.birthDate || undefined,
      documentFrontUrl: docFront?.url,
      documentBackUrl: docBack?.url,
      proofAddressUrl: proofAddress?.url,
    });
  };

  const submitCheckout = () => {
    if (!cart.items.length) return toast.error("Seu carrinho está vazio.");
    const name = profileForm.name.trim();
    if (!name) return toast.error("Complete seu nome na aba Meu Cadastro.");
    checkout.mutate({
      referralCode: getStoredReferralCode() ?? undefined,
      items: cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        paymentMethod,
      })),
      customer: {
        name,
        contact: submittedContact,
        contactType: submittedContact.includes("@") ? "EMAIL" : "WHATSAPP",
        email: profileForm.email.trim() || undefined,
        address: profileForm.address.trim() || undefined,
        city: profileForm.city.trim() || undefined,
        state: profileForm.state.trim() || undefined,
        zipCode: profileForm.zipCode.trim() || undefined,
      },
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/vitrine"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a vitrine
        </Link>

        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-7 text-white">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-200">
            <UserRound className="h-4 w-4" /> Área do cliente
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {identified && profileQuery.data
              ? `Olá, ${profileQuery.data.name.split(" ")[0]}`
              : "Minha conta"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Seu cadastro, histórico de compras, recomendações e carrinho — tudo
            em um só lugar, com o mesmo contato usado nas suas compras.
          </p>
        </header>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          {identified ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Conectado com:</span>{" "}
                <strong>{submittedContact}</strong>
              </div>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={switchAccount}>
                <LogOut className="h-3.5 w-3.5" /> Não é você? Trocar conta
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label htmlFor="customer-contact" className="text-sm font-medium">
                  Seu WhatsApp ou e-mail
                </label>
                <Input
                  id="customer-contact"
                  value={contact}
                  onChange={event => setContact(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") searchOrders();
                  }}
                  placeholder="(00) 00000-0000 ou voce@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  Já comprou com a gente? Use o mesmo contato para ver seus pedidos. Se for
                  novo, sua conta é criada automaticamente no próximo passo.
                </p>
              </div>
              <Button onClick={searchOrders} className="gap-2">
                <Search className="h-4 w-4" /> Entrar ou criar minha conta
              </Button>
            </div>
          )}
        </section>

        {isNewCustomer && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <UserPlus className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">
                  Você é novo por aqui — vamos criar sua conta
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Complete seu nome (e, se quiser, CPF/endereço/documentos) para liberar
                  pedidos, recomendações e carrinho com este contato.
                </p>
              </div>
            </div>
            <Button
              className="gap-2 bg-amber-600 hover:bg-amber-700"
              onClick={() => setActiveTab("cadastro")}
            >
              <UserPlus className="h-4 w-4" /> Criar minha conta agora
            </Button>
          </section>
        )}

        {identified && pendingOrders.length > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
              <div>
                <p className="font-semibold text-blue-900">
                  Você tem {pendingOrders.length}{" "}
                  {pendingOrders.length === 1 ? "reserva" : "reservas"} aguardando pagamento
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-800">
                  <Timer className="h-3.5 w-3.5" />
                  {nearestExpiry
                    ? `${formatTimeRemaining(nearestExpiry)} para a mais próxima — conclua o pagamento antes que expire.`
                    : "Conclua o pagamento antes que a reserva expire."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2 border-blue-300 bg-white"
              onClick={() => setActiveTab("pedidos")}
            >
              <Package className="h-4 w-4" /> Ver e concluir pagamento
            </Button>
          </section>
        )}

        {identified && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="mt-1 text-2xl font-bold">{totals.count}</p>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Total comprado</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {fmt(totals.totalPaid)}
                </p>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Carrinho atual</p>
                <p className="mt-1 text-2xl font-bold">
                  {cart.itemCount} {cart.itemCount === 1 ? "item" : "itens"}
                </p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
              <TabsList className="grid h-auto w-full grid-cols-4">
                <TabsTrigger value="pedidos" className="gap-2">
                  <Package className="h-4 w-4" />{" "}
                  <span className="hidden sm:inline">Meus pedidos</span>
                  <span className="sm:hidden">Pedidos</span>
                </TabsTrigger>
                <TabsTrigger value="recomendados" className="gap-2">
                  <Sparkles className="h-4 w-4" />{" "}
                  <span className="hidden sm:inline">Recomendados</span>
                  <span className="sm:hidden">Para você</span>
                </TabsTrigger>
                <TabsTrigger value="carrinho" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrinho
                  {cart.itemCount > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                      {cart.itemCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="cadastro" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />{" "}
                  <span className="hidden sm:inline">Meu cadastro</span>
                  <span className="sm:hidden">Cadastro</span>
                </TabsTrigger>
              </TabsList>

              {/* ── PEDIDOS ────────────────────────────────────────────── */}
              <TabsContent value="pedidos" className="space-y-4">
                {ordersQuery.isLoading && (
                  <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
                    Buscando seus pedidos…
                  </div>
                )}
                {!ordersQuery.isLoading && ordersQuery.data?.length === 0 && (
                  <div className="rounded-2xl border bg-white p-10 text-center">
                    <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Você ainda não tem pedidos registrados com este contato.
                    </p>
                  </div>
                )}
                {groups.length > 0 && (
                  <div className="space-y-4">
                    {groups.map(([groupId, orders]) => {
                      const rows = orders ?? [];
                      const createdAt = rows[0]?.createdAt;
                      return (
                        <section
                          key={groupId}
                          className="rounded-2xl border bg-white p-5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                {rows.length > 1 ? "Pedido agrupado" : "Pedido"}
                              </p>
                              <h2 className="mt-1 text-lg font-semibold">
                                {rows.map(order => `#${order.id}`).join(", ")}
                              </h2>
                            </div>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />{" "}
                              {createdAt
                                ? new Date(createdAt).toLocaleString("pt-BR")
                                : "—"}
                            </p>
                          </div>
                          <div className="mt-4 space-y-3">
                            {rows.map(order => {
                              const status = order.status as OrderStatus;
                              return (
                                <div
                                  key={order.id}
                                  className="flex gap-3 rounded-xl bg-slate-50 p-3"
                                >
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                                    {order.productImageUrl ? (
                                      <img
                                        src={order.productImageUrl}
                                        alt={order.productName}
                                        className="h-full w-full object-contain"
                                      />
                                    ) : (
                                      <Package className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="font-medium">
                                        {order.productName}
                                      </p>
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? STATUS_COLOR.EXPIRADO}`}
                                      >
                                        {STATUS_LABEL[status] ?? order.status}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {order.quantity} unidade(s) ·{" "}
                                      {fmt(Number(order.totalPrice))}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Pagamento:{" "}
                                      {PAYMENT_LABEL[order.paymentMethod] ??
                                        order.paymentMethod}
                                    </p>
                                    {(status === "AGUARDANDO_PAGAMENTO" ||
                                      status === "RESERVADO") && (
                                      <p
                                        className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                          isExpired(order.expiresAt)
                                            ? "bg-slate-200 text-slate-600"
                                            : "bg-amber-100 text-amber-800"
                                        }`}
                                      >
                                        <Timer className="h-3 w-3" />
                                        {formatTimeRemaining(order.expiresAt)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── RECOMENDADOS ───────────────────────────────────────── */}
              <TabsContent value="recomendados" className="space-y-4">
                <div className="rounded-2xl border bg-white p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <h2 className="font-semibold">
                      Produtos que podem te interessar
                    </h2>
                  </div>
                  {recommendationsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Carregando recomendações…
                    </p>
                  ) : recommendationsQuery.data?.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {recommendationsQuery.data.map((product: any) => (
                        <article
                          key={product.id}
                          className="overflow-hidden rounded-xl border bg-white"
                        >
                          <Link href={`/vitrine/${product.id}`}>
                            <div className="flex h-32 items-center justify-center bg-slate-50 p-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <ShoppingBag className="h-8 w-8 text-slate-300" />
                              )}
                            </div>
                          </Link>
                          <div className="space-y-2 p-3">
                            <Link href={`/vitrine/${product.id}`}>
                              <p className="line-clamp-2 text-sm font-medium hover:underline">
                                {product.name}
                              </p>
                            </Link>
                            <p className="font-bold">
                              {fmt(
                                Number(
                                  product.suggestedPricePix ||
                                    product.suggestedPrice ||
                                    0
                                )
                              )}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-1.5"
                              disabled={Number(product.stockQuantity) <= 0}
                              onClick={() =>
                                cart.addItem({
                                  productId: product.id,
                                  name: product.name,
                                  imageUrl: product.imageUrl ?? null,
                                  unitPrice: Number(
                                    product.suggestedPricePix ||
                                      product.suggestedPrice ||
                                      0
                                  ),
                                })
                              }
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />{" "}
                              {Number(product.stockQuantity) > 0
                                ? "Adicionar"
                                : "Sem estoque"}
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ainda não temos recomendações para você.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* ── CARRINHO ───────────────────────────────────────────── */}
              <TabsContent value="carrinho" className="space-y-4">
                {checkoutSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                    <h2 className="mt-3 text-lg font-semibold">
                      Pedido registrado!
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {checkoutSuccess.map(id => `#${id}`).join(", ")} — o
                      pagamento e a confirmação serão tratados pela equipe.
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setCheckoutSuccess(null)}
                    >
                      Continuar comprando
                    </Button>
                  </div>
                ) : cart.items.length ? (
                  <div className="rounded-2xl border bg-white p-5">
                    <div className="space-y-3">
                      {cart.items.map(item => (
                        <div
                          key={item.productId}
                          className="flex items-center gap-3 border-b pb-3 last:border-0"
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
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
                          </div>
                          <div className="flex items-center gap-2">
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
                              className="h-7 w-7 text-destructive"
                              onClick={() => cart.removeItem(item.productId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-4 text-base font-semibold">
                      <span>Total estimado</span>
                      <span>{fmt(cart.total)}</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label>Forma de pagamento</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={paymentMethod}
                          onChange={event =>
                            setPaymentMethod(event.target.value as PaymentMethod)
                          }
                        >
                          <option value="PIX">Pix</option>
                          <option value="DINHEIRO">Dinheiro</option>
                          <option value="CARTAO">Cartão</option>
                          <option value="BOLETO">Boleto</option>
                        </select>
                      </div>
                      {!profileForm.name.trim() && (
                        <p className="text-xs text-amber-700">
                          Complete seu nome na aba "Meu cadastro" antes de
                          fechar o pedido.
                        </p>
                      )}
                      <Button
                        className="w-full gap-2"
                        onClick={submitCheckout}
                        disabled={checkout.isPending}
                      >
                        <ShoppingCart className="h-4 w-4" />{" "}
                        {checkout.isPending
                          ? "Registrando…"
                          : "Fechar pedido"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border bg-white p-10 text-center">
                    <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Seu carrinho está vazio.
                    </p>
                    <Link
                      href="/vitrine"
                      className="mt-3 inline-block text-sm text-primary underline"
                    >
                      Ir para o catálogo
                    </Link>
                  </div>
                )}
              </TabsContent>

              {/* ── CADASTRO ───────────────────────────────────────────── */}
              <TabsContent value="cadastro" className="space-y-4">
                <div className="rounded-2xl border bg-white p-5 space-y-4">
                  <div>
                    <h2 className="font-semibold">Meus dados</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Estes são os mesmos dados usados para registrar suas
                      compras. Completar CPF e documentos agiliza análises de
                      crédito, boleto e promissória.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Nome completo</Label>
                      <Input
                        value={profileForm.name}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            name: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contato (WhatsApp ou e-mail)</Label>
                      <Input value={submittedContact} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={profileForm.email}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            email: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        value={profileForm.cpf}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            cpf: event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 11),
                          })
                        }
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RG</Label>
                      <Input
                        value={profileForm.rg}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            rg: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de nascimento</Label>
                      <Input
                        type="date"
                        value={profileForm.birthDate}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            birthDate: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Endereço completo</Label>
                      <Input
                        value={profileForm.address}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            address: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={profileForm.city}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            city: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input
                        maxLength={2}
                        value={profileForm.state}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            state: event.target.value.toUpperCase(),
                          })
                        }
                        placeholder="UF"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={profileForm.zipCode}
                        onChange={event =>
                          setProfileForm({
                            ...profileForm,
                            zipCode: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="mb-3 text-sm font-medium">
                      Documentação (opcional — usada para crediário e análise
                      de crédito)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <UploadSlot
                        label="Documento — frente"
                        value={docFront}
                        busy={documentUpload.uploading}
                        acceptLabel="RG, CNH ou documento oficial"
                        onSelect={() => documentUpload.capture(setDocFront)}
                      />
                      <UploadSlot
                        label="Documento — verso"
                        value={docBack}
                        busy={documentUpload.uploading}
                        acceptLabel="Opcional"
                        onSelect={() => documentUpload.capture(setDocBack)}
                      />
                      <UploadSlot
                        label="Comprovante de endereço"
                        value={proofAddress}
                        busy={documentUpload.uploading}
                        acceptLabel="Conta de luz, água ou similar"
                        onSelect={() =>
                          documentUpload.capture(setProofAddress)
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={submitProfile}
                      disabled={updateProfile.isPending}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />{" "}
                      {updateProfile.isPending
                        ? "Salvando…"
                        : "Salvar meus dados"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </main>
  );
}
