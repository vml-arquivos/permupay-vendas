/**
 * client/src/components/ReceiptModal.tsx
 *
 * Comprovante de pagamento — centralizado. Antes vivia só dentro de
 * Pedidos.tsx; agora é um componente único, reaproveitado por qualquer tela
 * que confirme um pedido (Pedidos, Nova Venda), sempre com o mesmo texto,
 * mesmo layout e o mesmo detalhamento de parcelas quando o pagamento é por
 * boleto — em vez de cada tela ter (ou não ter) sua própria versão.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, MessageCircle, Receipt, BadgeCheck, ShieldCheck, ShoppingBag, Download, FileSignature, Mail, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_LABEL } from "@/lib/orderStatus";
import {
  buildMailtoUrl,
  buildReceiptMessage,
  buildWhatsAppUrl,
  downloadBase64Pdf,
  type ReceiptOrderInput,
} from "@/lib/receipt";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export type ReceiptOrder = ReceiptOrderInput & {
  productImageUrl?: string | null;
};

export function ReceiptModal({
  order,
  open,
  onOpenChange,
}: {
  order: ReceiptOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notesQuery = trpc.promissoryNotes.byOrder.useQuery(
    { orderId: order?.id as number },
    { enabled: Boolean(order?.id && order.paymentMethod === "BOLETO") }
  );
  const installments = useMemo(
    () =>
      (notesQuery.data ?? []).map(n => ({
        installmentNumber: n.installmentNumber,
        amount: n.amount,
        dueDate: n.dueDate,
      })),
    [notesQuery.data]
  );

  const documentsLinkQuery = trpc.orders.documentsLink.useQuery(
    { orderId: order?.id as number },
    { enabled: Boolean(order?.id) }
  );
  const documentsUrl = documentsLinkQuery.data?.url ?? null;

  const message = useMemo(
    () => (order ? buildReceiptMessage(order, installments, documentsUrl) : ""),
    [order, installments, documentsUrl]
  );

  const pdfQuery = trpc.orders.receiptPdf.useQuery(
    { orderId: order?.id as number },
    { enabled: false }
  );

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Comprovante copiado.");
    } catch {
      toast.error("Não foi possível copiar o comprovante.");
    }
  };

  const handleWhatsApp = () => {
    if (!order) return;
    window.open(buildWhatsAppUrl(message, order.buyerContact), "_blank", "noopener,noreferrer");
  };

  const handleEmail = () => {
    if (!order) return;
    const to = order.buyerContact.includes("@") ? order.buyerContact : undefined;
    const url = buildMailtoUrl(message, {
      to,
      subject: `Comprovante e documentos — Pedido #${order.id} — Shoop PermuPay`,
    });
    window.location.href = url;
  };

  const handleCopyDocumentsLink = async () => {
    if (!documentsUrl) return;
    try {
      await navigator.clipboard.writeText(documentsUrl);
      toast.success("Link dos documentos copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!order) return;
    try {
      const result = await pdfQuery.refetch();
      if (result.data) {
        downloadBase64Pdf(result.data.base64, result.data.filename);
      } else {
        toast.error("Não foi possível gerar o PDF do comprovante.");
      }
    } catch {
      toast.error("Não foi possível gerar o PDF do comprovante.");
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden border-0 p-0">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900 text-white">
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <span className="text-lg font-semibold tracking-[0.28em]">SP</span>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200/80">
                    Comprovante oficial
                  </p>
                  <DialogTitle className="mt-1 text-2xl font-semibold text-white">
                    Shoop PermuPay
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-slate-300">
                    Confirmação premium de pagamento para envio ao cliente.
                  </DialogDescription>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200">Status</p>
                <p className="text-sm font-semibold text-emerald-100">Pagamento confirmado</p>
              </div>
            </div>
          </div>

          <div className="bg-white px-6 py-6 text-slate-900 sm:px-8">
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-slate-700" />
                  <h3 className="text-base font-semibold">Resumo do comprovante</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Pedido" value={`#${order.id}`} />
                  <Info label="Confirmado em" value={formatDateTime(order.confirmedAt)} />
                  <Info label="Cliente" value={order.buyerName} />
                  <Info label="Contato" value={order.buyerContact} />
                  <Info
                    label="Pagamento"
                    value={PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                  />
                  <Info label="Quantidade" value={`${order.quantity} un.`} />
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-base font-semibold text-emerald-900">Valor confirmado</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-900">{fmt(order.totalPrice)}</p>
                <p className="mt-2 text-sm text-emerald-800">
                  {order.quantity}x {fmt(order.unitPrice)}
                </p>
                <div className="mt-5 rounded-2xl bg-white/80 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-700">Produto</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {order.productImageUrl ? (
                        <img
                          src={order.productImageUrl}
                          alt={order.productName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-base font-semibold text-slate-900">{order.productName}</p>
                  </div>
                </div>
              </div>
            </div>

            {order.paymentMethod === "BOLETO" && installments.length > 0 && (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-amber-700" />
                  <h3 className="text-base font-semibold text-amber-900">
                    Parcelamento — {installments.length}x (notas promissórias geradas)
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {installments.map(inst => (
                    <div
                      key={inst.installmentNumber}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">
                        Parcela {inst.installmentNumber}/{installments.length}
                      </span>{" "}
                      — {fmt(inst.amount)} — vence {formatDate(inst.dueDate)}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-amber-800">
                  As notas ficam salvas no cadastro do cliente. Os boletos bancários só devem ser
                  enviados depois que o cliente assinar e devolver todas as notas promissórias.
                </p>
              </div>
            )}

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
                <h3 className="text-base font-semibold">Mensagem do cliente</h3>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-line">
                {message}
              </div>
              {documentsUrl && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{documentsUrl}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={handleCopyDocumentsLink}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </Button>
                </div>
              )}
            </div>

            {order.adminNotes && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Observação interna enviada no comprovante</p>
                <p className="mt-1">{order.adminNotes}</p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <div className="text-xs text-slate-500">
                Esse comprovante confirma o recebimento do pagamento e a liberação do pedido.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar comprovante
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={pdfQuery.isFetching}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {pdfQuery.isFetching ? "Gerando PDF..." : "Baixar PDF"}
                </Button>
                <Button variant="outline" onClick={handleEmail} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Enviar por e-mail
                </Button>
                <Button onClick={handleWhatsApp} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <MessageCircle className="h-4 w-4" />
                  Enviar pelo WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <strong className="mt-1 block text-sm text-slate-900">{value}</strong>
    </div>
  );
}
