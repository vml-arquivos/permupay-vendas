/**
 * client/src/pages/Pedidos.tsx
 *
 * ALTERAÇÕES:
 * - Status padrão alterado para AGUARDANDO_PAGAMENTO
 * - Label "Pago" substituído por "Pagamento Confirmado / Liberado para Retirada"
 * - Removida lógica de expiração de 2h (pedido não expira mais automaticamente)
 * - Botão "Confirmar Pagamento" debita estoque e ativa lote FIFO
 * - Cancelamento não devolve estoque (nunca foi debitado)
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
} from "lucide-react";
import { toast } from "sonner";

type OrderStatus =
  | "AGUARDANDO_PAGAMENTO"
  | "RESERVADO"
  | "PAGO"
  | "CANCELADO"
  | "EXPIRADO";

const STATUS_LABEL: Record<OrderStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguard. Pagamento",
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
  CARTAO: "Cartão",
  BOLETO: "Boleto",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pedidos() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "TODOS">(
    "TODOS"
  );
  const [confirmNotes, setConfirmNotes] = useState<Record<number, string>>({});
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
    onSuccess: () => {
      toast.success(
        "Pagamento confirmado! Estoque debitado. Pedido liberado para retirada."
      );
      utils.orders.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Pedido cancelado.");
      utils.orders.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const pendingOrders = orders.filter(
    (o) =>
      o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO"
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Pedidos & Pagamentos
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Confirme pagamentos manualmente para liberar produtos para retirada.
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

          {/* Alerta de pendentes */}
          {pendingOrders.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-800 font-medium">
                {pendingOrders.length} pedido(s) aguardando confirmação de
                pagamento
              </span>
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                "TODOS",
                "AGUARDANDO_PAGAMENTO",
                "PAGO",
                "CANCELADO",
                "EXPIRADO",
              ] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {s === "TODOS"
                  ? "Todos"
                  : STATUS_LABEL_SHORT[s as OrderStatus]}
              </button>
            ))}
          </div>

          {/* Lista */}
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

                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border bg-card transition-all ${
                      isPending ? "border-blue-200" : "border-border"
                    }`}
                  >
                    {/* Linha principal */}
                    <div
                      className="p-4 cursor-pointer select-none"
                      onClick={() =>
                        setExpanded(isOpen ? null : order.id)
                      }
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">
                              #{order.id} — {order.productName}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                STATUS_COLOR[order.status as OrderStatus]
                              }`}
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
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">
                            {fmt(order.totalPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.quantity}x {fmt(order.unitPrice)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {isOpen && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                        {order.adminNotes && (
                          <p className="text-xs text-muted-foreground italic">
                            Notas: {order.adminNotes}
                          </p>
                        )}

                        {isPending && (
                          <div className="space-y-3">
                            <textarea
                              placeholder="Notas internas (opcional)..."
                              rows={2}
                              value={confirmNotes[order.id] ?? ""}
                              onChange={(e) =>
                                setConfirmNotes((n) => ({
                                  ...n,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="w-full text-sm border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={confirm.isPending}
                                onClick={() =>
                                  confirm.mutate({
                                    orderId: order.id,
                                    adminNotes: confirmNotes[order.id],
                                  })
                                }
                              >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Pagamento
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 text-destructive hover:text-destructive"
                                disabled={cancel.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm("Cancelar este pedido?")
                                  ) {
                                    cancel.mutate({ orderId: order.id });
                                  }
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}

                        {order.status === "PAGO" && (
                          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                            <p className="text-xs text-green-800 font-medium">
                              ✓ Pagamento Confirmado / Liberado para Retirada
                            </p>
                            {order.confirmedAt && (
                              <p className="text-xs text-green-600 mt-0.5">
                                Confirmado em{" "}
                                {new Date(order.confirmedAt).toLocaleString(
                                  "pt-BR"
                                )}
                              </p>
                            )}
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
