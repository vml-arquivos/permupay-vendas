import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  ShoppingBag,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Receipt,
  Phone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_LABEL_SHORT,
  type OrderStatus,
} from "@/lib/orderStatus";
import { ReceiptModal, type ReceiptOrder } from "@/components/ReceiptModal";
import { buildReceiptMessage, buildWhatsAppUrl } from "@/lib/receipt";

// Mesmo formato de comprovante usado em qualquer tela que confirme um
// pedido — ver client/src/components/ReceiptModal.tsx e client/src/lib/receipt.ts.
type OrderItem = ReceiptOrder & { status: OrderStatus; createdAt: string | Date };

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

export default function Pedidos() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "TODOS">(
    "TODOS"
  );
  const [confirmNotes, setConfirmNotes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderItem | null>(null);

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = trpc.orders.list.useQuery(
    statusFilter === "TODOS" ? undefined : { status: statusFilter },
    { refetchInterval: 30_000 }
  );

  const confirm = trpc.orders.confirm.useMutation({
    onError: e => toast.error(e.message),
  });

  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Pedido cancelado.");
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.counts.invalidate(),
      ]);
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const deleteOrder = trpc.orders.delete.useMutation({
    onSuccess: async result => {
      const restored = Number((result as any)?.restoredQuantity ?? 0);
      toast.success(
        restored > 0
          ? `Pedido apagado e ${restored} unidade(s) devolvida(s) ao estoque.`
          : "Pedido apagado."
      );
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.counts.invalidate(),
      ]);
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const pendingOrders = orders.filter(
    (o: any) => o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO"
  );

  const handleConfirmPayment = (order: any) => {
    const ok = window.confirm(
      `Confirmar recebimento do pagamento do pedido #${order.id}?\n\n` +
        `${order.productName}\n` +
        `Cliente: ${order.buyerName}\n` +
        `Valor: ${fmt(order.totalPrice)}\n\n` +
        `Depois disso o pedido ficará liberado para retirada.`
    );

    if (!ok) return;

    confirm.mutate(
      {
        orderId: order.id,
        adminNotes: confirmNotes[order.id],
      },
      {
        onSuccess: async () => {
          const enrichedOrder: OrderItem = {
            ...order,
            status: "PAGO",
            confirmedAt: new Date().toISOString(),
            adminNotes: confirmNotes[order.id] ?? order.adminNotes ?? null,
          };

          toast.success("Pagamento confirmado! Comprovante pronto para envio.");
          await Promise.all([
            utils.orders.list.invalidate(),
            utils.orders.counts.invalidate(),
          ]);
          refetch();
          setReceiptOrder(enrichedOrder);
          setExpanded(order.id);
        },
      }
    );
  };

  const handleCancelOrder = (order: any) => {
    const ok = window.confirm(
      `Cancelar o pedido #${order.id}?\n\n` +
        `Essa ação não libera o pedido para retirada.`
    );
    if (!ok) return;
    cancel.mutate({ orderId: order.id, adminNotes: confirmNotes[order.id] });
  };

  const handleDeleteOrder = (order: any) => {
    const isPaid = order.status === "PAGO";
    const message = isPaid
      ? `APAGAR pedido #${order.id}?\n\nEste pedido está PAGO. Ao apagar, o sistema vai devolver ${order.quantity} unidade(s) ao estoque do produto.\n\nUse isso para limpar compras de teste.`
      : `APAGAR pedido #${order.id}?\n\nEste pedido não está pago. Ele será removido sem mexer no estoque.`;

    const ok = window.confirm(message);
    if (!ok) return;

    deleteOrder.mutate({ orderId: order.id, restoreStock: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pedidos & Pagamentos
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Confirme manualmente o recebimento do pagamento para liberar o
                produto e gerar um comprovante premium para o cliente.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>

          {pendingOrders.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-800 font-medium">
                {pendingOrders.length} pedido(s) aguardando confirmação de
                pagamento
              </span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {(
              [
                "TODOS",
                "AGUARDANDO_PAGAMENTO",
                "PAGO",
                "CANCELADO",
                "EXPIRADO",
              ] as const
            ).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {s === "TODOS" ? "Todos" : STATUS_LABEL_SHORT[s as OrderStatus]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum pedido encontrado
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order: any) => {
                const isOpen = expanded === order.id;
                const isPending =
                  order.status === "AGUARDANDO_PAGAMENTO" ||
                  order.status === "RESERVADO";
                const paidOrderForActions =
                  order.status === "PAGO" ? (order as OrderItem) : null;

                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border bg-card transition-all ${
                      isPending ? "border-blue-200 shadow-sm" : "border-border"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => setExpanded(isOpen ? null : order.id)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                              {order.productImageUrl ? (
                                <img
                                  src={order.productImageUrl}
                                  alt={order.productName}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <ShoppingBag
                                  className="h-5 w-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <span className="font-semibold text-foreground text-sm">
                              #{order.id} — {order.productName}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status as OrderStatus]}`}
                            >
                              {STATUS_LABEL_SHORT[order.status as OrderStatus]}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {PAYMENT_LABEL[order.paymentMethod] ??
                                order.paymentMethod}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.buyerName} · {order.buyerContact} ·{" "}
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </button>

                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <div className="text-right min-w-[110px]">
                            <p className="font-bold text-foreground">
                              {fmt(order.totalPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.quantity}x {fmt(order.unitPrice)}
                            </p>
                          </div>

                          {isPending && (
                            <div
                              className="flex items-center gap-2"
                              onClick={e => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={confirm.isPending}
                                onClick={() => handleConfirmPayment(order)}
                              >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar recebimento
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 text-destructive hover:text-destructive"
                                disabled={cancel.isPending}
                                onClick={() => handleCancelOrder(order)}
                              >
                                <XCircle className="w-4 h-4" />
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 text-destructive hover:text-destructive"
                                disabled={deleteOrder.isPending}
                                onClick={() => handleDeleteOrder(order)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Apagar
                              </Button>
                            </div>
                          )}

                          {paidOrderForActions && (
                            <div
                              className="flex items-center gap-2"
                              onClick={e => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() =>
                                  setReceiptOrder(paidOrderForActions)
                                }
                              >
                                <Receipt className="w-4 h-4" />
                                Ver comprovante
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 text-destructive hover:text-destructive"
                                disabled={deleteOrder.isPending}
                                onClick={() => handleDeleteOrder(order)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Apagar
                              </Button>
                            </div>
                          )}

                          {!isPending && !paidOrderForActions && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 text-destructive hover:text-destructive"
                              disabled={deleteOrder.isPending}
                              onClick={() => handleDeleteOrder(order)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Apagar
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() =>
                              setExpanded(isOpen ? null : order.id)
                            }
                          >
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">
                              Status
                            </span>
                            <strong>
                              {STATUS_LABEL[order.status as OrderStatus]}
                            </strong>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">
                              Pagamento
                            </span>
                            <strong>
                              {PAYMENT_LABEL[order.paymentMethod] ??
                                order.paymentMethod}
                            </strong>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">
                              Contato
                            </span>
                            <strong>{order.buyerContact}</strong>
                          </div>
                        </div>

                        {order.adminNotes && (
                          <p className="text-xs text-muted-foreground italic">
                            Notas: {order.adminNotes}
                          </p>
                        )}

                        {isPending && (
                          <div className="space-y-3">
                            <textarea
                              placeholder="Notas internas antes de confirmar/cancelar (opcional)..."
                              rows={2}
                              value={confirmNotes[order.id] ?? ""}
                              onChange={e =>
                                setConfirmNotes(n => ({
                                  ...n,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="w-full text-sm border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                            />
                            <p className="text-xs text-muted-foreground">
                              Ao confirmar recebimento, o sistema marca o pedido
                              como liberado, debita o estoque com segurança e já
                              monta um comprovante premium pronto para enviar.
                            </p>
                          </div>
                        )}

                        {order.status === "PAGO" && (
                          <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-white border border-emerald-200 px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-emerald-900 font-semibold">
                                  ✓ Pagamento confirmado / pedido liberado para
                                  retirada
                                </p>
                                {order.confirmedAt && (
                                  <p className="text-xs text-emerald-700 mt-1">
                                    Confirmado em{" "}
                                    {new Date(order.confirmedAt).toLocaleString(
                                      "pt-BR"
                                    )}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() =>
                                    setReceiptOrder(order as OrderItem)
                                  }
                                >
                                  <Receipt className="w-4 h-4" />
                                  Ver comprovante premium
                                </Button>
                                <Button
                                  size="sm"
                                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => {
                                    const o = order as OrderItem;
                                    const url = buildWhatsAppUrl(
                                      buildReceiptMessage(o),
                                      o.buyerContact
                                    );
                                    window.open(
                                      url,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }}
                                >
                                  <Phone className="w-4 h-4" />
                                  Enviar no WhatsApp
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ReceiptModal
        order={receiptOrder}
        open={!!receiptOrder}
        onOpenChange={open => !open && setReceiptOrder(null)}
      />
    </div>
  );
}
