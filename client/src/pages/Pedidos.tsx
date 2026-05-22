/**
 * client/src/pages/Pedidos.tsx
 *
 * Correção desta fase:
 * - Confirmação manual de recebimento de pagamento diretamente na linha do pedido.
 * - Botão claro: "Confirmar recebimento".
 * - Confirmação antes de liberar pedido.
 * - Pedido confirmado vira PAGO / Liberado para retirada.
 * - Suporte visual para PIX, DINHEIRO, CARTAO e BOLETO.
 * - Ações não dependem mais de abrir a linha para aparecer.
 */
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
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

type OrderStatus =
  | "AGUARDANDO_PAGAMENTO"
  | "RESERVADO"
  | "PAGO"
  | "CANCELADO"
  | "EXPIRADO";

const STATUS_LABEL: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  RESERVADO: "Reservado",
  PAGO: "Pagamento Confirmado / Liberado para Retirada",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

const STATUS_LABEL_SHORT: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguard. Pagamento",
  RESERVADO: "Reservado",
  PAGO: "Liberado ✓",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "bg-blue-100 text-blue-800 border-blue-200",
  RESERVADO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PAGO: "bg-green-100 text-green-800 border-green-200",
  CANCELADO: "bg-red-100 text-red-800 border-red-200",
  EXPIRADO: "bg-gray-100 text-gray-500 border-gray-200",
};

const PAYMENT_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
};

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function buildReceiptMessage(order: any) {
  return [
    `Olá, ${order.buyerName}! Sua compra foi confirmada.`,
    "",
    `Produto: ${order.productName}`,
    `Quantidade: ${order.quantity}`,
    `Valor total: ${fmt(order.totalPrice)}`,
    `Forma de pagamento: ${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}`,
    "Status: Compra confirmada / liberada para retirada.",
    "",
    "Obrigado pela preferência!",
  ].join("\n");
}

function openWhatsAppReceipt(order: any) {
  const message = encodeURIComponent(buildReceiptMessage(order));
  const digits = onlyDigits(order.buyerContact);
  const phone = digits.length >= 10 ? `55${digits.replace(/^55/, "")}` : "";
  window.open(phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`, "_blank");
}

export default function Pedidos() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "TODOS">("TODOS");
  const [confirmNotes, setConfirmNotes] = useState<Record<number, string>>({});
  const [finalPaymentMethods, setFinalPaymentMethods] = useState<Record<number, PaymentMethod>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = trpc.orders.list.useQuery(
    statusFilter === "TODOS" ? undefined : { status: statusFilter },
    { refetchInterval: 30_000 }
  );

  const confirm = trpc.orders.confirm.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento confirmado! Pedido liberado para retirada.");
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.orders.counts.invalidate(),
      ]);
      refetch();
    },
    onError: (e) => toast.error(e.message),
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
    onError: (e) => toast.error(e.message),
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

    confirm.mutate({
      orderId: order.id,
      adminNotes: confirmNotes[order.id],
      paymentMethod: finalPaymentMethods[order.id] ?? order.paymentMethod,
    });
  };

  const handleCancelOrder = (order: any) => {
    const ok = window.confirm(
      `Cancelar o pedido #${order.id}?\n\n` +
      `Essa ação não libera o pedido para retirada.`
    );
    if (!ok) return;
    cancel.mutate({ orderId: order.id, adminNotes: confirmNotes[order.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pedidos & Pagamentos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Confirme manualmente o recebimento do pagamento para liberar o produto para retirada.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>

          {pendingOrders.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-800 font-medium">
                {pendingOrders.length} pedido(s) aguardando confirmação de pagamento
              </span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {(["TODOS", "AGUARDANDO_PAGAMENTO", "RESERVADO", "PAGO", "CANCELADO", "EXPIRADO"] as const).map((s) => (
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
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order: any) => {
                const isOpen = expanded === order.id;
                const isPending = order.status === "AGUARDANDO_PAGAMENTO" || order.status === "RESERVADO";

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
                            <span className="font-semibold text-foreground text-sm">
                              #{order.id} — {order.productName}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status as OrderStatus]}`}>
                              {STATUS_LABEL_SHORT[order.status as OrderStatus]}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.buyerName} · {order.buyerContact} · {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </button>

                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <div className="text-right min-w-[110px]">
                            <p className="font-bold text-foreground">{fmt(order.totalPrice)}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.quantity}x {fmt(order.unitPrice)}
                            </p>
                          </div>

                          {isPending && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                            </div>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setExpanded(isOpen ? null : order.id)}
                          >
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">Status</span>
                            <strong>{STATUS_LABEL[order.status as OrderStatus]}</strong>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">Pagamento</span>
                            <strong>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</strong>
                          </div>
                          <div className="rounded-md bg-muted/30 px-3 py-2">
                            <span className="block text-muted-foreground">Contato</span>
                            <strong>{order.buyerContact}</strong>
                          </div>
                        </div>

                        {order.adminNotes && (
                          <p className="text-xs text-muted-foreground italic">Notas: {order.adminNotes}</p>
                        )}

                        {isPending && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Forma final de pagamento</label>
                              <select
                                value={finalPaymentMethods[order.id] ?? order.paymentMethod}
                                onChange={(e) =>
                                  setFinalPaymentMethods((current) => ({
                                    ...current,
                                    [order.id]: e.target.value as PaymentMethod,
                                  }))
                                }
                                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                              >
                                <option value="PIX">PIX</option>
                                <option value="DINHEIRO">Dinheiro</option>
                                <option value="CARTAO">Cartão</option>
                                <option value="BOLETO">Boleto</option>
                              </select>
                            </div>
                            <textarea
                              placeholder="Notas internas antes de confirmar/cancelar (opcional)..."
                              rows={2}
                              value={confirmNotes[order.id] ?? ""}
                              onChange={(e) =>
                                setConfirmNotes((n) => ({ ...n, [order.id]: e.target.value }))
                              }
                              className="w-full text-sm border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                            />
                            <p className="text-xs text-muted-foreground">
                              Ao confirmar recebimento, o sistema marca o pedido como liberado e debita o estoque com segurança.
                            </p>
                          </div>
                        )}

                        {order.status === "PAGO" && (
                          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 space-y-3">
                            <div>
                              <p className="text-xs text-green-800 font-medium">
                                ✓ Pagamento Confirmado / Liberado para Retirada
                              </p>
                              {order.confirmedAt && (
                                <p className="text-xs text-green-600 mt-0.5">
                                  Confirmado em {new Date(order.confirmedAt).toLocaleString("pt-BR")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => openWhatsAppReceipt(order)}>
                                <MessageCircle className="w-4 h-4" /> Compartilhar comprovante pelo WhatsApp
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(buildReceiptMessage(order));
                                  toast.success("Mensagem do comprovante copiada.");
                                }}
                              >
                                <Copy className="w-4 h-4" /> Copiar mensagem
                              </Button>
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
    </div>
  );
}
