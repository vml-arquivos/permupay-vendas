import { useMemo, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import {
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL_SHORT } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/orderStatus";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const CREDIT_STATUS_LABEL: Record<string, string> = {
  NAO_ANALISADO: "Não analisado",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

const CREDIT_STATUS_VARIANT: Record<
  string,
  "secondary" | "outline" | "destructive"
> = {
  NAO_ANALISADO: "outline",
  APROVADO: "secondary",
  REPROVADO: "destructive",
};

const NOTE_STATUS_LABEL: Record<string, string> = {
  GERADA: "Gerada — aguardando envio",
  ENVIADA: "Enviada — aguardando assinatura",
  ASSINADA_DEVOLVIDA: "Assinada e devolvida",
  CANCELADA: "Cancelada",
};

const NOTE_STATUS_VARIANT: Record<
  string,
  "secondary" | "outline" | "destructive"
> = {
  GERADA: "outline",
  ENVIADA: "secondary",
  ASSINADA_DEVOLVIDA: "secondary",
  CANCELADA: "destructive",
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

type UploadValue = {
  url: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

type FormState = {
  name: string;
  contact: string;
  contactType: "WHATSAPP" | "EMAIL";
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  cpf: string;
  rg: string;
  birthDate: string;
};

const initialForm: FormState = {
  name: "",
  contact: "",
  contactType: "WHATSAPP",
  email: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  cpf: "",
  rg: "",
  birthDate: "",
};

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
          <p className="font-medium">{label}</p>
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
          className="mt-3 h-28 w-full rounded-lg bg-muted object-contain"
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full gap-2"
        onClick={onSelect}
        disabled={busy}
      >
        <Upload className="h-4 w-4" />{" "}
        {busy ? "Enviando…" : value ? "Trocar arquivo" : "Selecionar arquivo"}
      </Button>
    </div>
  );
}

function CustomerReportDialog({
  customerId,
  open,
  onOpenChange,
  isAdmin,
}: {
  customerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const customerQuery = trpc.customers.byId.useQuery(
    { id: customerId as number },
    { enabled: Boolean(customerId) }
  );
  const ordersQuery = trpc.orders.list.useQuery(
    { customerId: customerId as number },
    { enabled: Boolean(customerId) }
  );
  const notesQuery = trpc.promissoryNotes.byCustomer.useQuery(
    { customerId: customerId as number },
    { enabled: Boolean(customerId) }
  );
  const updateNoteStatus = trpc.promissoryNotes.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status da nota promissória atualizado.");
      await utils.promissoryNotes.byCustomer.invalidate({
        customerId: customerId as number,
      });
    },
    onError: error => toast.error(error.message),
  });
  const [creditNotes, setCreditNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const updateCredit = trpc.customers.updateCreditStatus.useMutation({
    onSuccess: async () => {
      toast.success("Análise de crédito atualizada.");
      await Promise.all([
        utils.customers.byId.invalidate({ id: customerId as number }),
        utils.customers.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const customer = customerQuery.data;
  const orders = ordersQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const totalPaid = orders
    .filter(order => order.status === "PAGO")
    .reduce((acc, order) => acc + Number(order.totalPrice ?? 0), 0);
  const totalPending = orders
    .filter(
      order =>
        order.status === "AGUARDANDO_PAGAMENTO" || order.status === "RESERVADO"
    )
    .reduce((acc, order) => acc + Number(order.totalPrice ?? 0), 0);

  const handleOpenDocuments = async (orderId: number) => {
    try {
      const { url } = await utils.orders.documentsLink.fetch({ orderId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível gerar o link de documentos.");
    }
  };

  const handleCopyDocuments = async (orderId: number) => {
    try {
      const { url } = await utils.orders.documentsLink.fetch({ orderId });
      await navigator.clipboard.writeText(url);
      toast.success("Link de documentos copiado.");
    } catch {
      toast.error("Não foi possível copiar o link de documentos.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + overflow-y-auto: sem isso, um cliente com muitas compras e
          notas fazia o diálogo ficar mais alto que a tela, cortando e
          embaralhando o conteúdo com a página por trás — este era o layout
          "horrível" reportado. Agora o conteúdo rola dentro do próprio
          diálogo, que nunca ultrapassa a tela. */}
      {/* sm:max-w-3xl explícito: sem ele, o "sm:max-w-lg" do DialogContent
          base sobrevive ao merge de classes (tailwind-merge não remove
          variantes responsivas diferentes) e prende este diálogo em 512px
          em qualquer tela ≥640px — mesma causa raiz corrigida no
          comprovante (ver ReceiptModal.tsx). */}
      <DialogContent className="flex max-h-[88vh] w-full max-w-3xl sm:max-w-3xl flex-col overflow-hidden p-0">
        <div className="border-b px-6 pb-4 pt-6">
          <DialogTitle>{customer?.name ?? "Cliente"}</DialogTitle>
          <DialogDescription>
            Relatório completo: compras, análise de crédito e documentos
            (comprovantes e notas promissórias).
          </DialogDescription>
        </div>

        {!customer ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">
                  Contato
                </span>
                <strong className="text-sm">{customer.contact}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">
                  CPF
                </span>
                <strong className="text-sm">
                  {customer.cpf || "Não informado"}
                </strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">
                  Total pago
                </span>
                <strong className="text-sm text-emerald-700">
                  {fmt(totalPaid)}
                </strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">
                  Em aberto
                </span>
                <strong className="text-sm text-amber-700">
                  {fmt(totalPending)}
                </strong>
              </div>
            </div>

            <Tabs defaultValue="compras" className="mt-5 space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="compras" className="gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> Compras
                </TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1.5">
                  <FileSignature className="h-3.5 w-3.5" /> Documentos
                  {notes.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                      {notes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="credito" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Crédito
                </TabsTrigger>
              </TabsList>

              {/* ── COMPRAS ──────────────────────────────────────────── */}
              <TabsContent value="compras" className="space-y-3">
                {ordersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : orders.length ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2">Pedido</th>
                          <th className="px-3 py-2">Produto</th>
                          <th className="px-3 py-2">Pagamento</th>
                          <th className="px-3 py-2">Situação</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-right">Documentos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.id} className="border-b last:border-0">
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              #{order.id}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                                  {order.productImageUrl ? (
                                    <img
                                      src={order.productImageUrl}
                                      alt={order.productName}
                                      className="h-full w-full object-contain"
                                    />
                                  ) : (
                                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span>{order.productName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {PAYMENT_LABEL[order.paymentMethod] ??
                                order.paymentMethod}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[order.status as OrderStatus]}`}
                              >
                                {STATUS_LABEL_SHORT[order.status as OrderStatus]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {fmt(order.totalPrice)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => handleOpenDocuments(order.id)}
                              >
                                <Download className="h-3.5 w-3.5" /> Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este cliente ainda não possui compras registradas.
                  </p>
                )}
              </TabsContent>

              {/* ── DOCUMENTOS (comprovantes + notas promissórias) ──────── */}
              <TabsContent value="documentos" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Link com comprovante e notas promissórias de cada pedido — o mesmo
                  incluído automaticamente na mensagem enviada ao cliente por WhatsApp/e-mail.
                </p>
                {orders.length > 0 && (
                  <div className="space-y-2">
                    {orders.map(order => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            Pedido #{order.id} — {order.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} ·{" "}
                            {fmt(order.totalPrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => handleCopyDocuments(order.id)}
                          >
                            Copiar link
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => handleOpenDocuments(order.id)}
                          >
                            <Download className="h-3.5 w-3.5" /> Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {notes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      <FileSignature className="h-4 w-4" /> Notas promissórias
                    </p>
                    {notes.map(note => (
                      <div
                        key={note.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            Pedido #{note.orderId} — parcela {note.installmentNumber}/
                            {note.installmentsTotal} — {fmt(note.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento {formatDate(note.dueDate)} ·{" "}
                            {note.productDescription}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={NOTE_STATUS_VARIANT[note.status] ?? "outline"}>
                            {NOTE_STATUS_LABEL[note.status] ?? note.status}
                          </Badge>
                          {note.documentUrl && (
                            <a
                              href={note.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary underline"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF
                            </a>
                          )}
                          {isAdmin && note.status === "GERADA" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              disabled={updateNoteStatus.isPending}
                              onClick={() =>
                                updateNoteStatus.mutate({
                                  noteId: note.id,
                                  status: "ENVIADA",
                                })
                              }
                            >
                              <Send className="h-3.5 w-3.5" /> Marcar enviada
                            </Button>
                          )}
                          {isAdmin && note.status === "ENVIADA" && (
                            <Button
                              size="sm"
                              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                              disabled={updateNoteStatus.isPending}
                              onClick={() =>
                                updateNoteStatus.mutate({
                                  noteId: note.id,
                                  status: "ASSINADA_DEVOLVIDA",
                                })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Assinada e devolvida
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Envie os boletos bancários de pagamento somente depois que todas as
                      parcelas acima estiverem marcadas como "Assinada e devolvida".
                    </p>
                  </div>
                )}

                {!orders.length && !notes.length && (
                  <p className="text-sm text-muted-foreground">
                    Este cliente ainda não possui pedidos ou documentos.
                  </p>
                )}
              </TabsContent>

              {/* ── CRÉDITO ──────────────────────────────────────────── */}
              <TabsContent value="credito" className="space-y-3">
                <div className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Análise de crédito</p>
                    <Badge
                      variant={
                        CREDIT_STATUS_VARIANT[customer.creditStatus] ?? "outline"
                      }
                    >
                      {CREDIT_STATUS_LABEL[customer.creditStatus] ??
                        customer.creditStatus}
                    </Badge>
                  </div>
                  {customer.creditNotes && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      Observação atual: {customer.creditNotes}
                    </p>
                  )}
                  {isAdmin ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Observações da análise de crédito (opcional)"
                        value={creditNotes}
                        onChange={event => setCreditNotes(event.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Limite de crédito (R$, opcional)"
                        value={creditLimit}
                        onChange={event => setCreditLimit(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                          disabled={updateCredit.isPending}
                          onClick={() =>
                            updateCredit.mutate({
                              customerId: customer.id,
                              creditStatus: "APROVADO",
                              creditNotes: creditNotes || undefined,
                              creditLimit: creditLimit
                                ? Number(creditLimit)
                                : undefined,
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar crédito
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive"
                          disabled={updateCredit.isPending}
                          onClick={() =>
                            updateCredit.mutate({
                              customerId: customer.id,
                              creditStatus: "REPROVADO",
                              creditNotes: creditNotes || undefined,
                            })
                          }
                        >
                          Reprovar crédito
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Somente o administrador pode alterar a análise de crédito.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Clientes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [creditFilter, setCreditFilter] = useState<string>("TODOS");
  const [form, setForm] = useState<FormState>(initialForm);
  const [docFront, setDocFront] = useState<UploadValue | null>(null);
  const [docBack, setDocBack] = useState<UploadValue | null>(null);
  const [proofAddress, setProofAddress] = useState<UploadValue | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const documentUpload = useDocumentUpload("clientes");

  const customersQuery = trpc.customers.list.useQuery({
    search: search.trim() || undefined,
    creditStatus:
      creditFilter === "TODOS" ? undefined : (creditFilter as any),
  });

  const registerCustomer = trpc.customers.register.useMutation({
    onSuccess: async () => {
      toast.success("Cliente cadastrado com sucesso.");
      setForm(initialForm);
      setDocFront(null);
      setDocBack(null);
      setProofAddress(null);
      await utils.customers.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setField = (field: keyof FormState, value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const handleRegister = () => {
    if (!form.name.trim() || !form.contact.trim()) {
      toast.error("Informe nome e contato do cliente.");
      return;
    }
    registerCustomer.mutate({
      name: form.name.trim(),
      contact: form.contact.trim(),
      contactType: form.contactType,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zipCode: form.zipCode.trim() || undefined,
      cpf: form.cpf.trim() || undefined,
      rg: form.rg.trim() || undefined,
      birthDate: form.birthDate || undefined,
      documentFrontUrl: docFront?.url,
      documentBackUrl: docBack?.url,
      proofAddressUrl: proofAddress?.url,
    });
  };

  const customers = customersQuery.data ?? [];
  const summary = useMemo(
    () => ({
      total: customers.length,
      aprovados: customers.filter(c => c.creditStatus === "APROVADO").length,
      pendentes: customers.filter(c => c.creditStatus === "NAO_ANALISADO")
        .length,
    }),
    [customers]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro completo de clientes (dados pessoais, documentos e
            análise de crédito para crediário, boleto e promissória) e
            relatório de compras.
          </p>
        </div>

        <Tabs defaultValue="lista" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="lista" className="gap-2">
              <Users className="h-4 w-4" /> Clientes cadastrados
            </TabsTrigger>
            <TabsTrigger value="novo" className="gap-2">
              <Plus className="h-4 w-4" /> Novo cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Total de clientes
                  </p>
                  <p className="mt-1 text-2xl font-bold">{summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Crédito aprovado
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {summary.aprovados}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Aguardando análise
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">
                    {summary.pendentes}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> Clientes
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="w-56 pl-8"
                      placeholder="Buscar por nome, contato ou CPF"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={creditFilter}
                    onChange={event => setCreditFilter(event.target.value)}
                  >
                    <option value="TODOS">Todas as situações</option>
                    <option value="NAO_ANALISADO">Não analisado</option>
                    <option value="APROVADO">Aprovado</option>
                    <option value="REPROVADO">Reprovado</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {customersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : customers.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-3">Cliente</th>
                          <th className="px-3 py-3">Contato</th>
                          <th className="px-3 py-3">CPF</th>
                          <th className="px-3 py-3">Crédito</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map(customer => (
                          <tr key={customer.id} className="border-b last:border-0">
                            <td className="px-3 py-3 font-medium">
                              {customer.name}
                            </td>
                            <td className="px-3 py-3">{customer.contact}</td>
                            <td className="px-3 py-3">
                              {customer.cpf || "—"}
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                variant={
                                  CREDIT_STATUS_VARIANT[
                                    customer.creditStatus
                                  ] ?? "outline"
                                }
                              >
                                {CREDIT_STATUS_LABEL[customer.creditStatus] ??
                                  customer.creditStatus}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() =>
                                    setSelectedCustomerId(customer.id)
                                  }
                                >
                                  <FileText className="h-3.5 w-3.5" /> Relatório
                                </Button>
                                <Link href={`/clientes/${customer.id}`}>
                                  <Button size="sm" className="gap-1">
                                    <UserRound className="h-3.5 w-3.5" /> Ver perfil
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="novo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" /> Dados pessoais e de contato
                </CardTitle>
                <CardDescription>
                  Cadastre o cliente para poder registrar vendas, crediário e
                  análise de crédito.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.name}
                    onChange={event => setField("name", event.target.value)}
                    placeholder="Nome completo do cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contato (WhatsApp ou e-mail)</Label>
                  <Input
                    value={form.contact}
                    onChange={event => setField("contact", event.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de contato</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.contactType}
                    onChange={event =>
                      setField(
                        "contactType",
                        event.target.value as "WHATSAPP" | "EMAIL"
                      )
                    }
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">E-mail</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={event =>
                      setField(
                        "cpf",
                        event.target.value.replace(/\D/g, "").slice(0, 11)
                      )
                    }
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input
                    value={form.rg}
                    onChange={event => setField("rg", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={form.birthDate}
                    onChange={event =>
                      setField("birthDate", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={event => setField("email", event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço completo</Label>
                  <Input
                    value={form.address}
                    onChange={event => setField("address", event.target.value)}
                    placeholder="Rua, número e complemento"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.city}
                    onChange={event => setField("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    maxLength={2}
                    value={form.state}
                    onChange={event =>
                      setField("state", event.target.value.toUpperCase())
                    }
                    placeholder="UF"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.zipCode}
                    onChange={event => setField("zipCode", event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Documentação
                </CardTitle>
                <CardDescription>
                  Necessária para crediário, análise de crédito e emissão de
                  boleto/promissória. Pode ser enviada depois, se necessário.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
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
                  acceptLabel="Opcional, quando houver verso"
                  onSelect={() => documentUpload.capture(setDocBack)}
                />
                <UploadSlot
                  label="Comprovante de endereço"
                  value={proofAddress}
                  busy={documentUpload.uploading}
                  acceptLabel="Conta de luz, água ou similar"
                  onSelect={() => documentUpload.capture(setProofAddress)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="gap-2"
                onClick={handleRegister}
                disabled={registerCustomer.isPending}
              >
                <Plus className="h-4 w-4" />{" "}
                {registerCustomer.isPending ? "Cadastrando…" : "Cadastrar cliente"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CustomerReportDialog
        customerId={selectedCustomerId}
        open={Boolean(selectedCustomerId)}
        onOpenChange={open => !open && setSelectedCustomerId(null)}
        isAdmin={isAdmin}
      />
    </DashboardLayout>
  );
}
