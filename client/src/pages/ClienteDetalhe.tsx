/**
 * client/src/pages/ClienteDetalhe.tsx
 *
 * Página individual completa do cliente — /clientes/:id.
 *
 * Antes só existia um diálogo (CustomerReportDialog, dentro de Clientes.tsx)
 * para ver o relatório do cliente. Esta página cobre o mesmo conteúdo (e
 * mais) como uma rota própria: cadastro, documentos, análise de crédito
 * (agora com histórico), histórico de compras (paginado), histórico de
 * pagamentos como visão própria, boletos/notas relacionadas, e ações de
 * WhatsApp/e-mail com registro em trilha de auditoria.
 *
 * Autorização: qualquer usuário autenticado (protectedProcedure) pode ver —
 * mesmo modelo já usado em /clientes (CRM interno, sem escopo por vendedor).
 * Alterar análise de crédito continua restrito a admin (adminOnlyProcedure).
 */
import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wallet,
  History,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL_SHORT } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/orderStatus";
import { buildWhatsAppUrl, buildMailtoUrl, buildReceiptMessage } from "@/lib/receipt";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

const formatDateTime = (value?: string | Date | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const CREDIT_STATUS_LABEL: Record<string, string> = {
  NAO_ANALISADO: "Não analisado",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

const CREDIT_STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
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

const NOTE_STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  GERADA: "outline",
  ENVIADA: "secondary",
  ASSINADA_DEVOLVIDA: "secondary",
  CANCELADA: "destructive",
};

const PAGE_SIZE = 10;

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 opacity-40" />
      </div>
      <p className="max-w-xs text-center text-sm">{text}</p>
    </div>
  );
}

const emptyCustomerForm = () => ({
  name: "",
  contact: "",
  contactType: "WHATSAPP" as "WHATSAPP" | "EMAIL",
  email: "",
  cpf: "",
  rg: "",
  birthDate: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
});

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const [ordersPage, setOrdersPage] = useState(0);
  const [creditNotes, setCreditNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [editingCadastro, setEditingCadastro] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm());
  const [printingAll, setPrintingAll] = useState(false);

  const validId = Number.isFinite(customerId) && customerId > 0;

  const customerQuery = trpc.customers.byId.useQuery(
    { id: customerId },
    { enabled: validId }
  );
  const ordersQuery = trpc.orders.list.useQuery(
    { customerId, limit: PAGE_SIZE, offset: ordersPage * PAGE_SIZE },
    { enabled: validId }
  );
  const ordersCountQuery = trpc.orders.countByCustomer.useQuery(
    { customerId },
    { enabled: validId }
  );
  const notesQuery = trpc.promissoryNotes.byCustomer.useQuery(
    { customerId },
    { enabled: validId }
  );
  const creditHistoryQuery = trpc.customers.creditHistory.useQuery(
    { customerId },
    { enabled: validId }
  );
  const communicationsQuery = trpc.customers.communications.list.useQuery(
    { customerId },
    { enabled: validId }
  );

  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: async () => {
      toast.success("Cadastro atualizado com sucesso.");
      setEditingCadastro(false);
      await Promise.all([
        utils.customers.byId.invalidate({ id: customerId }),
        utils.customers.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: async () => {
      toast.success("Cadastro excluído. Pedidos e notas já emitidos foram preservados.");
      await utils.customers.list.invalidate();
      setLocation("/clientes");
    },
    onError: (error) => toast.error(error.message),
  });

  const logCommunication = trpc.customers.communications.log.useMutation({
    onSuccess: () => utils.customers.communications.list.invalidate({ customerId }),
    onError: () => {
      // Nunca bloqueia o envio em si (o link wa.me/mailto já abriu) — só
      // avisa que o registro da trilha de auditoria falhou.
      toast.warning("O link foi aberto, mas não foi possível registrar na trilha de auditoria.");
    },
  });

  const updateNoteStatus = trpc.promissoryNotes.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status da nota promissória atualizado.");
      await utils.promissoryNotes.byCustomer.invalidate({ customerId });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCredit = trpc.customers.updateCreditStatus.useMutation({
    onSuccess: async () => {
      toast.success("Análise de crédito atualizada.");
      await Promise.all([
        utils.customers.byId.invalidate({ id: customerId }),
        utils.customers.creditHistory.invalidate({ customerId }),
        utils.customers.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  // Carrega o formulário de edição sempre que os dados do cliente chegarem
  // (ou trocarem) — mas nunca por cima de uma edição em andamento, para não
  // apagar o que o usuário já digitou se uma invalidação disparar de novo.
  useEffect(() => {
    if (!customerQuery.data || editingCadastro) return;
    const c = customerQuery.data;
    setCustomerForm({
      name: c.name ?? "",
      contact: c.contact ?? "",
      contactType: (c.contactType as "WHATSAPP" | "EMAIL") ?? "WHATSAPP",
      email: c.email ?? "",
      cpf: c.cpf ?? "",
      rg: c.rg ?? "",
      birthDate: c.birthDate ? String(c.birthDate).slice(0, 10) : "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zipCode: c.zipCode ?? "",
    });
  }, [customerQuery.data, editingCadastro]);

  if (!validId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">Cliente inválido.</p>
            <Link href="/clientes">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (customerQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (customerQuery.error || !customerQuery.data) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {customerQuery.error?.message ?? "Cliente não encontrado."}
            </p>
            <Link href="/clientes">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const customer = customerQuery.data;
  const orders = ordersQuery.data ?? [];
  const ordersTotal = ordersCountQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(ordersTotal / PAGE_SIZE));
  const notes = notesQuery.data ?? [];
  const creditHistory = creditHistoryQuery.data?.items ?? [];
  const communications = communicationsQuery.data?.items ?? [];

  const paidOrders = orders.filter((o: any) => o.status === "PAGO");
  const totalPaid = paidOrders.reduce((acc: number, o: any) => acc + Number(o.totalPrice ?? 0), 0);
  const totalPending = orders
    .filter((o: any) => o.status === "AGUARDANDO_PAGAMENTO" || o.status === "RESERVADO")
    .reduce((acc: number, o: any) => acc + Number(o.totalPrice ?? 0), 0);

  const handleOpenDocuments = async (orderId: number) => {
    try {
      const { url } = await utils.orders.documentsLink.fetch({ orderId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível gerar o link de documentos.");
    }
  };

  const handleSendWhatsApp = async (order: any) => {
    try {
      const { url: documentsUrl } = await utils.orders.documentsLink.fetch({ orderId: order.id });
      const message = buildReceiptMessage(order, null, documentsUrl);
      const waUrl = buildWhatsAppUrl(message, customer.contact);
      window.open(waUrl, "_blank", "noopener,noreferrer");
      logCommunication.mutate({
        customerId,
        orderId: order.id,
        channel: "WHATSAPP",
        purpose: "comprovante",
        target: customer.contact,
        messagePreview: message.slice(0, 500),
      });
    } catch {
      toast.error("Não foi possível montar o link do WhatsApp.");
    }
  };

  const handleSendEmail = async (order: any) => {
    try {
      const { url: documentsUrl } = await utils.orders.documentsLink.fetch({ orderId: order.id });
      const message = buildReceiptMessage(order, null, documentsUrl);
      const mailUrl = buildMailtoUrl(message, {
        to: customer.email ?? undefined,
        subject: `Comprovante — Pedido #${order.id}`,
      });
      window.open(mailUrl, "_blank");
      logCommunication.mutate({
        customerId,
        orderId: order.id,
        channel: "EMAIL",
        purpose: "comprovante",
        target: customer.email || "(email não cadastrado)",
        messagePreview: message.slice(0, 500),
      });
    } catch {
      toast.error("Não foi possível montar o e-mail.");
    }
  };

  const handleSaveCadastro = () => {
    if (!customerForm.name.trim()) return toast.error("Informe o nome do cliente.");
    if (!customerForm.contact.trim()) return toast.error("Informe o contato do cliente.");
    updateCustomer.mutate({
      id: customerId,
      name: customerForm.name.trim(),
      contact: customerForm.contact.trim(),
      contactType: customerForm.contactType,
      email: customerForm.email.trim(),
      cpf: customerForm.cpf.trim() || undefined,
      rg: customerForm.rg.trim() || undefined,
      birthDate: customerForm.birthDate || undefined,
      address: customerForm.address.trim() || undefined,
      city: customerForm.city.trim() || undefined,
      state: customerForm.state.trim() || undefined,
      zipCode: customerForm.zipCode.trim() || undefined,
    });
  };

  const handleCancelEditCadastro = () => {
    setEditingCadastro(false);
    setCustomerForm({
      name: customer.name ?? "",
      contact: customer.contact ?? "",
      contactType: (customer.contactType as "WHATSAPP" | "EMAIL") ?? "WHATSAPP",
      email: customer.email ?? "",
      cpf: customer.cpf ?? "",
      rg: customer.rg ?? "",
      birthDate: customer.birthDate ? String(customer.birthDate).slice(0, 10) : "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zipCode: customer.zipCode ?? "",
    });
  };

  const handlePrintAllNotes = async () => {
    const printableNotes = notes.filter((n: any) => n.status !== "CANCELADA");
    if (printableNotes.length === 0) {
      toast.error("Este cliente não tem notas promissórias para imprimir.");
      return;
    }
    setPrintingAll(true);
    try {
      const result = await utils.promissoryNotes.mergedPdfByCustomer.fetch({ customerId });
      const byteChars = atob(result.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      toast.success(`${result.count} nota(s) promissória(s) prontas — abra e use "Imprimir" no visualizador de PDF.`);
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível juntar as notas promissórias para impressão.");
    } finally {
      setPrintingAll(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/clientes">
              <span className="mb-1 inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Voltar para clientes
              </span>
            </Link>
            <h1 className="truncate text-2xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.contact}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CREDIT_STATUS_VARIANT[customer.creditStatus] ?? "outline"}>
              {CREDIT_STATUS_LABEL[customer.creditStatus] ?? customer.creditStatus}
            </Badge>
            {!editingCadastro ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingCadastro(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar cadastro
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCancelEditCadastro} disabled={updateCustomer.isPending}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleSaveCadastro} disabled={updateCustomer.isPending}>
                  {updateCustomer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Atualizar
                </Button>
              </>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir cadastro
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir o cadastro de {customer.name}?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Esta ação apaga o cadastro do cliente e não pode ser desfeita.</p>
                        <p>
                          Pedidos e notas promissórias já emitidos <strong className="text-foreground">não são apagados</strong> — eles ficam sem
                          cliente vinculado, preservando o histórico de vendas e faturamento.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteCustomerMutation.mutate({ id: customerId })}
                    >
                      Excluir cadastro
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* ── Cadastro (resumo / edição) ────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" /> Cadastro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingCadastro ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs">Nome completo</Label>
                  <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de contato</Label>
                  <Select
                    value={customerForm.contactType}
                    onValueChange={(v) => setCustomerForm({ ...customerForm, contactType: v as "WHATSAPP" | "EMAIL" })}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="EMAIL">E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contato (WhatsApp ou e-mail)</Label>
                  <Input value={customerForm.contact} onChange={(e) => setCustomerForm({ ...customerForm, contact: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CPF</Label>
                  <Input value={customerForm.cpf} onChange={(e) => setCustomerForm({ ...customerForm, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })} inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">RG</Label>
                  <Input value={customerForm.rg} onChange={(e) => setCustomerForm({ ...customerForm, rg: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de nascimento</Label>
                  <Input type="date" value={customerForm.birthDate} onChange={(e) => setCustomerForm({ ...customerForm, birthDate: e.target.value })} />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label className="text-xs">Endereço completo</Label>
                  <Input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado (UF)</Label>
                  <Input maxLength={2} value={customerForm.state} onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CEP</Label>
                  <Input value={customerForm.zipCode} onChange={(e) => setCustomerForm({ ...customerForm, zipCode: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <span className="block text-xs text-muted-foreground">Contato</span>
                  <strong className="text-sm">{customer.contact}</strong>
                </div>
                <div className="rounded-xl border p-3">
                  <span className="block text-xs text-muted-foreground">E-mail</span>
                  <strong className="text-sm">{customer.email || "Não informado"}</strong>
                </div>
                <div className="rounded-xl border p-3">
                  <span className="block text-xs text-muted-foreground">CPF</span>
                  <strong className="text-sm">{customer.cpf || "Não informado"}</strong>
                </div>
                <div className="rounded-xl border p-3">
                  <span className="block text-xs text-muted-foreground">Endereço</span>
                  <strong className="text-sm">
                    {customer.address ? `${customer.address}${customer.city ? ` — ${customer.city}/${customer.state ?? ""}` : ""}` : "Não informado"}
                  </strong>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Total pago</span>
                <strong className="text-sm text-emerald-700">{fmt(totalPaid)}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Em aberto</span>
                <strong className="text-sm text-amber-700">{fmt(totalPending)}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Cliente desde</span>
                <strong className="text-sm">{customer.createdAt ? formatDate(customer.createdAt) : "—"}</strong>
              </div>
              <div className="rounded-xl border p-3">
                <span className="block text-xs text-muted-foreground">Total de pedidos</span>
                <strong className="text-sm">{ordersTotal}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="compras" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            <TabsTrigger value="compras" className="gap-1.5 text-xs">
              <ShoppingBag className="h-3.5 w-3.5" /> Compras
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5 text-xs">
              <Wallet className="h-3.5 w-3.5" /> Pagamentos
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs">
              <FileSignature className="h-3.5 w-3.5" /> Documentos
              {notes.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                  {notes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="credito" className="gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Crédito
            </TabsTrigger>
            <TabsTrigger value="comunicacoes" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> Comunicações
            </TabsTrigger>
          </TabsList>

          {/* ── COMPRAS (paginado) ─────────────────────────────────────── */}
          <TabsContent value="compras" className="space-y-3">
            {ordersQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : orders.length ? (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2">Pedido</th>
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2">Pagamento</th>
                        <th className="px-3 py-2">Situação</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order: any) => (
                        <tr key={order.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground">#{order.id}</td>
                          <td className="px-3 py-2">{order.productName}</td>
                          <td className="px-3 py-2">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status as OrderStatus]}`}>
                              {STATUS_LABEL_SHORT[order.status as OrderStatus]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(order.totalPrice)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => handleOpenDocuments(order.id)}>
                                <Download className="h-3.5 w-3.5" /> Doc
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-emerald-700" onClick={() => handleSendWhatsApp(order)} disabled={logCommunication.isPending}>
                                <MessageCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-blue-700" onClick={() => handleSendEmail(order)} disabled={logCommunication.isPending}>
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Página {ordersPage + 1} de {totalPages} — {ordersTotal} pedido(s)
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={ordersPage === 0} onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}>
                        Anterior
                      </Button>
                      <Button size="sm" variant="outline" disabled={ordersPage + 1 >= totalPages} onClick={() => setOrdersPage((p) => p + 1)}>
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={ShoppingBag} text="Este cliente ainda não possui compras registradas." />
            )}
          </TabsContent>

          {/* ── PAGAMENTOS — visão dedicada (pedidos com status PAGO) ────── */}
          <TabsContent value="pagamentos" className="space-y-3">
            {paidOrders.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Pedido</th>
                      <th className="px-3 py-2">Forma</th>
                      <th className="px-3 py-2">Confirmado em</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidOrders.map((order: any) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-xs text-muted-foreground">#{order.id}</td>
                        <td className="px-3 py-2">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</td>
                        <td className="px-3 py-2">{formatDateTime(order.confirmedAt)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmt(order.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Wallet} text="Nenhum pagamento confirmado nesta página. Mude de página em Compras para ver outros períodos." />
            )}
          </TabsContent>

          {/* ── DOCUMENTOS (comprovantes + notas promissórias) ───────────── */}
          <TabsContent value="documentos" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground max-w-md">
                Link com comprovante e notas promissórias de cada pedido desta página — o mesmo incluído na mensagem de WhatsApp/e-mail.
              </p>
              {notes.length > 0 && (
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handlePrintAllNotes} disabled={printingAll}>
                  {printingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  Imprimir todas de uma vez
                </Button>
              )}
            </div>
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note: any) => (
                  <div key={note.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        Pedido #{note.orderId} — parcela {note.installmentNumber}/{note.installmentsTotal} — {fmt(note.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento {formatDate(note.dueDate)} · {note.productDescription}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        Linha digitável: não disponível — este sistema gera nota promissória em PDF, não um boleto bancário registrado (exigiria integração paga com um banco/gateway, não configurada neste ambiente).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={NOTE_STATUS_VARIANT[note.status] ?? "outline"}>
                        {NOTE_STATUS_LABEL[note.status] ?? note.status}
                      </Badge>
                      {note.documentUrl && (
                        <>
                          <a href={note.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                            <Download className="h-3.5 w-3.5" /> Baixar
                          </a>
                          <a href={note.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                            <Printer className="h-3.5 w-3.5" /> Imprimir
                          </a>
                        </>
                      )}
                      {isAdmin && note.status === "GERADA" && (
                        <Button size="sm" variant="outline" className="gap-1" disabled={updateNoteStatus.isPending} onClick={() => updateNoteStatus.mutate({ noteId: note.id, status: "ENVIADA" })}>
                          Marcar enviada
                        </Button>
                      )}
                      {isAdmin && note.status === "ENVIADA" && (
                        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={updateNoteStatus.isPending} onClick={() => updateNoteStatus.mutate({ noteId: note.id, status: "ASSINADA_DEVOLVIDA" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Assinada
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={FileText} text="Este cliente ainda não possui notas promissórias/boletos." />
            )}
          </TabsContent>

          {/* ── CRÉDITO (com histórico) ───────────────────────────────────── */}
          <TabsContent value="credito" className="space-y-3">
            <div className="rounded-xl border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Análise de crédito — status atual</p>
                <Badge variant={CREDIT_STATUS_VARIANT[customer.creditStatus] ?? "outline"}>
                  {CREDIT_STATUS_LABEL[customer.creditStatus] ?? customer.creditStatus}
                </Badge>
              </div>
              {customer.creditNotes && (
                <p className="mb-3 text-xs text-muted-foreground">Observação atual: {customer.creditNotes}</p>
              )}
              {customer.creditLimit != null && (
                <p className="mb-3 text-xs text-muted-foreground">Limite de crédito: {fmt(Number(customer.creditLimit))}</p>
              )}
              {isAdmin ? (
                <div className="space-y-2">
                  <Textarea placeholder="Observações da análise de crédito (opcional)" value={creditNotes} onChange={(e) => setCreditNotes(e.target.value)} />
                  <Input type="number" min="0" step="0.01" placeholder="Limite de crédito (R$, opcional)" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={updateCredit.isPending}
                      onClick={() => updateCredit.mutate({ customerId, creditStatus: "APROVADO", creditNotes: creditNotes || undefined, creditLimit: creditLimit ? Number(creditLimit) : undefined })}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar crédito
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={updateCredit.isPending}
                      onClick={() => updateCredit.mutate({ customerId, creditStatus: "REPROVADO", creditNotes: creditNotes || undefined })}>
                      Reprovar crédito
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Somente o administrador pode alterar a análise de crédito.</p>
              )}
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" /> Histórico de análise de crédito
              </p>
              {creditHistoryQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : creditHistory.length ? (
                <div className="space-y-2">
                  {creditHistory.map((h: any) => (
                    <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                      <div className="min-w-0">
                        <p>
                          {h.previousStatus ? `${CREDIT_STATUS_LABEL[h.previousStatus] ?? h.previousStatus} → ` : ""}
                          <strong>{CREDIT_STATUS_LABEL[h.newStatus] ?? h.newStatus}</strong>
                        </p>
                        {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma mudança de status registrada ainda.</p>
              )}
            </div>
          </TabsContent>

          {/* ── COMUNICAÇÕES (trilha de auditoria de envios) ─────────────── */}
          <TabsContent value="comunicacoes" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Registro de quando um comprovante foi enviado por WhatsApp/e-mail a partir desta página, e por qual atendente — confirma que a ação foi
              disparada, não que o cliente recebeu/leu (isso exigiria integração paga com um provedor de mensageria, não configurada neste ambiente).
            </p>
            {communicationsQuery.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : communications.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Quando</th>
                      <th className="px-3 py-2">Canal</th>
                      <th className="px-3 py-2">Motivo</th>
                      <th className="px-3 py-2">Destino</th>
                      <th className="px-3 py-2">Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {communications.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0 text-xs">
                        <td className="px-3 py-2">{formatDateTime(c.createdAt)}</td>
                        <td className="px-3 py-2">{c.channel === "WHATSAPP" ? "WhatsApp" : "E-mail"}</td>
                        <td className="px-3 py-2 capitalize">{c.purpose}</td>
                        <td className="px-3 py-2">{c.target}</td>
                        <td className="px-3 py-2">{c.orderId ? `#${c.orderId}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={History} text="Nenhum envio registrado ainda. Use os botões de WhatsApp/e-mail na aba Compras." />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
