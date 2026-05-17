/**
 * Pedidos.tsx — Painel admin de pedidos e reservas
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  ShoppingBag,
  RefreshCw,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

type OrderStatus = "RESERVADO" | "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO" | "EXPIRADO";

const STATUS_LABEL: Record<OrderStatus, string> = {
  RESERVADO: "Reservado",
  AGUARDANDO_PAGAMENTO: "Aguard. Pagamento",
  PAGO: "Pago ✓",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  RESERVADO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  AGUARDANDO_PAGAMENTO: "bg-blue-100 text-blue-800 border-blue-200",
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

function timeLeft(expiresAt: string | Date): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function Pedidos() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "TODOS">("TODOS");
  const [confirmNotes, setConfirmNotes] = useState<Record<number, string>>({});
  const [cancelNotes, setCancelNotes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: orders = [], isLoading, refetch } = trpc.orders.list.useQuery(
    statusFilter === "TODOS" ? undefined : { status: statusFilter },
    { refetchInterval: 30000 } // auto-refresh a cada 30s
  );

  const confirm = trpc.orders.confirm.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado! Estoque atualizado.");
      utils.orders.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Pedido cancelado. Estoque devolvido.");
      utils.orders.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const expire = trpc.orders.expireStale.useMutation({
    onSuccess: (count) => {
      toast.success(`${count} reserva(s) expirada(s) processada(s)`);
      utils.orders.list.invalidate();
    },
  });

  const pendingOrders = orders.filter(
    (o) => o.status === "RESERVADO" || o.status === "AGUARDANDO_PAGAMENTO"
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pedidos & Reservas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Confirme pagamentos manualmente. Reservas expiram em 2 horas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => expire.mutate()}
                disabled={expire.isPending}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Expirar Vencidas
              </Button>
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
          </div>

          {/* Alerta de pendentes */}
          {pendingOrders.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
              <span className="text-sm text-yellow-800 font-medium">
                {pendingOrders.length} reserva(s) aguardando confirmação de pagamento
              </span>
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {(["TODOS", "RESERVADO", "AGUARDANDO_PAGAMENTO", "PAGO", "CANCELADO", "EXPIRADO"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {s === "TODOS" ? "Todos" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Lista */}
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
                const isPending = order.status === "RESERVADO" || order.status === "AGUARDANDO_PAGAMENTO";
                const isExpired = order.status === "EXPIRADO";

                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border bg-card transition-all ${
                      isPending ? "border-yellow-200" : "border-border"
                    }`}
                  >
                    {/* Linha principal */}
                    <div
                      className="p-4 cursor-pointer select-none"
                      onClick={() => setExpanded(isOpen ? null : order.id)}
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
                              {STATUS_LABEL[order.status as OrderStatus]}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.buyerName} · {order.buyerContact} ·{" "}
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{fmt(order.totalPrice)}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.quantity}x {fmt(order.unitPrice)}
                          </p>
                          {isPending && !isExpired && (
                            <p className="text-xs text-yellow-600 mt-1">
                              Expira em: {timeLeft(order.expiresAt)}
                            </p>
                          )}
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
                                setConfirmNotes((n) => ({ ...n, [order.id]: e.target.value }))
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
                                  if (confirm(window.confirm("Cancelar este pedido e devolver ao estoque?"))) {
                                    cancel.mutate({
                                      orderId: order.id,
                                      adminNotes: cancelNotes[order.id],
                                    });
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
                          <p className="text-xs text-green-700">
                            ✓ Confirmado em{" "}
                            {order.confirmedAt
                              ? new Date(order.confirmedAt).toLocaleString("pt-BR")
                              : "—"}
                          </p>
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
