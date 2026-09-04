/**
 * client/src/pages/Promissorias.tsx
 *
 * Central única de notas promissórias — antes só davam pra ser vistas
 * abrindo o relatório de cada cliente, uma por uma (Clientes → Relatório →
 * aba Documentos). Esta página lista TODAS as notas do sistema, com busca,
 * filtro por status, baixar/imprimir o PDF e trocar o status — o "local
 * fácil de acessar" pedido explicitamente, sem precisar entrar no cliente.
 */
import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Download,
  FileSignature,
  Link as LinkIcon,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";

type NoteStatus = "GERADA" | "ENVIADA" | "ASSINADA_DEVOLVIDA" | "CANCELADA";

const STATUS_LABEL: Record<NoteStatus, string> = {
  GERADA: "Gerada — aguardando envio",
  ENVIADA: "Enviada — aguardando assinatura",
  ASSINADA_DEVOLVIDA: "Assinada e devolvida",
  CANCELADA: "Cancelada",
};

const STATUS_VARIANT: Record<
  NoteStatus,
  "secondary" | "outline" | "destructive"
> = {
  GERADA: "outline",
  ENVIADA: "secondary",
  ASSINADA_DEVOLVIDA: "secondary",
  CANCELADA: "destructive",
};

const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export default function Promissorias() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<NoteStatus | "TODOS">(
    "TODOS"
  );
  const [search, setSearch] = useState("");

  const notesQuery = trpc.promissoryNotes.list.useQuery({
    status: statusFilter === "TODOS" ? undefined : statusFilter,
    search: search.trim() || undefined,
  });
  const notes = notesQuery.data ?? [];

  const updateStatus = trpc.promissoryNotes.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success("Status da nota atualizado.");
      await utils.promissoryNotes.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const summary = useMemo(() => {
    const all = notesQuery.data ?? [];
    return {
      total: all.length,
      geradas: all.filter(n => n.status === "GERADA").length,
      enviadas: all.filter(n => n.status === "ENVIADA").length,
      assinadas: all.filter(n => n.status === "ASSINADA_DEVOLVIDA").length,
    };
  }, [notesQuery.data]);

  const handleCopyDocuments = async (orderId: number) => {
    try {
      const { url } = await utils.orders.documentsLink.fetch({ orderId });
      await navigator.clipboard.writeText(url);
      toast.success("Link de documentos copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notas promissórias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as notas geradas automaticamente nas vendas em boleto — veja, baixe,
            imprima e acompanhe a assinatura, num único lugar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Aguardando envio</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {summary.geradas}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Aguardando assinatura
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-700">
                {summary.enviadas}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Assinadas e devolvidas
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {summary.assinadas}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por cliente, pedido ou CPF/CNPJ"
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={event =>
              setStatusFilter(event.target.value as NoteStatus | "TODOS")
            }
          >
            <option value="TODOS">Todos os status</option>
            <option value="GERADA">Gerada</option>
            <option value="ENVIADA">Enviada</option>
            <option value="ASSINADA_DEVOLVIDA">Assinada e devolvida</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>

        {notesQuery.isLoading ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Carregando notas…
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma nota promissória encontrada. Elas são criadas automaticamente
              quando uma venda é fechada em boleto parcelado.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => (
              <div
                key={note.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    Pedido #{note.orderId} — {note.issuerName} — parcela{" "}
                    {note.installmentNumber}/{note.installmentsTotal} —{" "}
                    {fmt(note.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento {formatDate(note.dueDate)} · {note.productDescription}
                    {note.issuerDocument ? ` · CPF/CNPJ ${note.issuerDocument}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[note.status as NoteStatus] ?? "outline"}>
                    {STATUS_LABEL[note.status as NoteStatus] ?? note.status}
                  </Badge>
                  {note.documentUrl && (
                    <a
                      href={note.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar/imprimir PDF
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => handleCopyDocuments(note.orderId)}
                  >
                    <LinkIcon className="h-3.5 w-3.5" /> Link do pedido
                  </Button>
                  {isAdmin && note.status === "GERADA" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({ noteId: note.id, status: "ENVIADA" })
                      }
                    >
                      <Send className="h-3.5 w-3.5" /> Marcar enviada
                    </Button>
                  )}
                  {isAdmin && note.status === "ENVIADA" && (
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
