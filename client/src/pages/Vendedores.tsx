import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  ExternalLink,
  CheckCircle,
  FileText,
  Plus,
  Trash2,
  Trophy,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (value: number) =>
  Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
type RankingPeriod = "7d" | "30d" | "90d" | "all";

export default function Vendedores() {
  const utils = trpc.useUtils();
  const sellersQuery = trpc.sellers.list.useQuery();
  const commissionsQuery = trpc.sellers.commissions.list.useQuery();
  const pendingQuery = trpc.sellers.pending.useQuery();
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("30d");
  const rankingQuery = trpc.sellers.ranking.useQuery({ period: rankingPeriod });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>(
    {}
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    type: "EXTERNO" as "INTERNO" | "EXTERNO",
    userId: "",
    referralCode: "",
    commissionType: "PERCENT" as "PERCENT" | "FIXED",
    commissionValue: "5",
  });
  const [sellerFilter, setSellerFilter] = useState<string>("TODOS");

  const createSeller = trpc.sellers.create.useMutation({
    onSuccess: async () => {
      toast.success("Vendedor criado.");
      setForm({
        name: "",
        email: "",
        phone: "",
        type: "EXTERNO",
        userId: "",
        referralCode: "",
        commissionType: "PERCENT",
        commissionValue: "5",
      });
      await utils.sellers.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateSeller = trpc.sellers.update.useMutation({
    onSuccess: () => utils.sellers.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const deleteSeller = trpc.sellers.delete.useMutation({
    onSuccess: async () => {
      toast.success("Vendedor inativado.");
      await utils.sellers.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const approveSeller = trpc.sellers.approve.useMutation({
    onSuccess: async () => {
      toast.success("Vendedor aprovado.");
      await Promise.all([
        utils.sellers.pending.invalidate(),
        utils.sellers.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const rejectSeller = trpc.sellers.reject.useMutation({
    onSuccess: async () => {
      toast.success("Solicitação rejeitada.");
      await Promise.all([
        utils.sellers.pending.invalidate(),
        utils.sellers.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const markPaid = trpc.sellers.commissions.markPaid.useMutation({
    onSuccess: async () => {
      toast.success("Comissão marcada como paga.");
      await utils.sellers.commissions.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const filteredCommissions = useMemo(() => {
    const rows = commissionsQuery.data ?? [];
    return sellerFilter === "TODOS"
      ? rows
      : rows.filter(row => row.sellerId === Number(sellerFilter));
  }, [commissionsQuery.data, sellerFilter]);

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do vendedor.");
    const commissionValue = Number(form.commissionValue || 0);
    if (
      !Number.isFinite(commissionValue) ||
      commissionValue < 0 ||
      (form.commissionType === "PERCENT" && commissionValue > 100)
    )
      return toast.error("Informe uma comissão válida.");
    createSeller.mutate({
      name: form.name.trim(),
      type: form.type,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      userId:
        form.type === "INTERNO" && form.userId.trim()
          ? Number(form.userId)
          : undefined,
      referralCode: form.referralCode.trim() || undefined,
      commissionType: form.commissionType,
      commissionValue,
      active: true,
    });
  };

  const copyLink = async (accessToken: string | null) => {
    if (!accessToken)
      return toast.error("Vendedor interno não possui link externo.");
    await navigator.clipboard.writeText(
      `${window.location.origin}/vendedor/${encodeURIComponent(accessToken)}`
    );
    toast.success("Link de vendedor copiado.");
  };
  const copyStoreLink = async (referralCode: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/loja/${encodeURIComponent(referralCode)}`
    );
    toast.success("Link da loja copiado.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Links externos, vendas internas atribuídas, análise de identidade e
            comissões auditáveis.
          </p>
        </div>
        <Tabs defaultValue="pendentes" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="pendentes" className="gap-2">
              <FileText className="h-4 w-4" /> Pendentes
              {pendingQuery.data?.length
                ? ` (${pendingQuery.data.length})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="gap-2">
              <Users className="h-4 w-4" /> Vendedores
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="h-4 w-4" /> Ranking
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-2">
              <WalletCards className="h-4 w-4" /> Comissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Solicitações pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando solicitações…
                  </p>
                ) : pendingQuery.data?.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {pendingQuery.data.map(seller => (
                      <article
                        key={seller.id}
                        className="rounded-2xl border p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="font-semibold">{seller.name}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {seller.email || "Sem e-mail"} ·{" "}
                              {seller.phone || "Sem telefone"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              CPF: {seller.cpf || "Não informado"}
                            </p>
                          </div>
                          <Badge variant="outline">Pendente</Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {(
                            [
                              { label: "Frente", url: seller.documentFrontUrl },
                              { label: "Verso", url: seller.documentBackUrl },
                              { label: "Selfie", url: seller.selfiePhotoUrl },
                            ] as const
                          ).map(document => (
                            <button
                              type="button"
                              key={document.label}
                              className="overflow-hidden rounded-lg border bg-slate-50 text-left"
                              onClick={() =>
                                document.url && setPreviewUrl(document.url)
                              }
                              disabled={!document.url}
                            >
                              {document.url ? (
                                <img
                                  src={document.url}
                                  alt={`Documento ${document.label}`}
                                  className="h-24 w-full object-contain"
                                />
                              ) : (
                                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                                  Não enviado
                                </div>
                              )}
                              <span className="block border-t px-2 py-1 text-xs">
                                {document.label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2">
                          <Textarea
                            placeholder="Motivo da rejeição (opcional)"
                            value={rejectReasons[seller.id] ?? ""}
                            onChange={event =>
                              setRejectReasons(current => ({
                                ...current,
                                [seller.id]: event.target.value,
                              }))
                            }
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              className="gap-2 text-destructive"
                              onClick={() =>
                                rejectSeller.mutate({
                                  id: seller.id,
                                  reason: rejectReasons[seller.id] || undefined,
                                })
                              }
                              disabled={rejectSeller.isPending}
                            >
                              <XCircle className="h-4 w-4" /> Rejeitar
                            </Button>
                            <Button
                              className="gap-2"
                              onClick={() =>
                                approveSeller.mutate({ id: seller.id })
                              }
                              disabled={approveSeller.isPending}
                            >
                              <CheckCircle className="h-4 w-4" /> Aprovar
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma solicitação pendente.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendedores" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Novo vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-8">
                <Input
                  className="md:col-span-2"
                  placeholder="Nome completo"
                  value={form.name}
                  onChange={event =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={event =>
                    setForm({
                      ...form,
                      type: event.target.value as "INTERNO" | "EXTERNO",
                    })
                  }
                >
                  <option value="EXTERNO">Externo</option>
                  <option value="INTERNO">Interno</option>
                </select>
                <Input
                  placeholder="E-mail"
                  value={form.email}
                  onChange={event =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
                <Input
                  placeholder="Telefone"
                  value={form.phone}
                  onChange={event =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
                {form.type === "INTERNO" ? (
                  <Input
                    type="number"
                    min="1"
                    placeholder="user_id"
                    value={form.userId}
                    onChange={event =>
                      setForm({ ...form, userId: event.target.value })
                    }
                  />
                ) : (
                  <Input
                    placeholder="Código de indicação"
                    value={form.referralCode}
                    onChange={event =>
                      setForm({
                        ...form,
                        referralCode: event.target.value.toUpperCase(),
                      })
                    }
                  />
                )}
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.commissionType}
                  onChange={event =>
                    setForm({
                      ...form,
                      commissionType: event.target.value as "PERCENT" | "FIXED",
                    })
                  }
                >
                  <option value="PERCENT">Comissão %</option>
                  <option value="FIXED">Comissão fixa</option>
                </select>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={
                      form.commissionType === "PERCENT"
                        ? "Percentual"
                        : "Valor em R$"
                    }
                    value={form.commissionValue}
                    onChange={event =>
                      setForm({ ...form, commissionValue: event.target.value })
                    }
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={createSeller.isPending}
                  >
                    Criar
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Vendedores cadastrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sellersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : sellersQuery.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-3">Vendedor</th>
                          <th className="px-3 py-3">Tipo</th>
                          <th className="px-3 py-3">Links</th>
                          <th className="px-3 py-3">Comissão</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellersQuery.data.map(seller => (
                          <tr
                            key={seller.id}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-3">
                              <div className="font-medium">{seller.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {seller.email ||
                                  seller.phone ||
                                  seller.contact ||
                                  "Sem contato"}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline">{seller.type}</Badge>
                            </td>
                            <td className="space-y-1 px-3 py-3">
                              <div>
                                {seller.type === "EXTERNO" ? (
                                  <button
                                    className="font-mono text-xs text-primary hover:underline"
                                    onClick={() => copyLink(seller.accessToken)}
                                  >
                                    {seller.accessToken
                                      ? `${seller.accessToken.slice(0, 12)}…`
                                      : "sem token"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Sessão interna
                                  </span>
                                )}
                              </div>
                              {seller.type === "EXTERNO" && (
                                <button
                                  className="text-xs text-primary hover:underline"
                                  onClick={() =>
                                    copyStoreLink(seller.referralCode)
                                  }
                                >
                                  Copiar loja /{seller.referralCode}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {seller.commissionType === "FIXED"
                                ? fmt(Number(seller.commissionValue))
                                : `${Number(seller.commissionValue || seller.commissionRate).toLocaleString("pt-BR")}%`}
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                variant={
                                  seller.active ? "secondary" : "outline"
                                }
                              >
                                {seller.status ||
                                  (seller.active ? "APROVADO" : "INATIVO")}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => copyLink(seller.accessToken)}
                                  disabled={seller.type !== "EXTERNO"}
                                >
                                  <Copy className="h-3.5 w-3.5" /> Link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateSeller.mutate({
                                      id: seller.id,
                                      active: !seller.active,
                                    })
                                  }
                                >
                                  {seller.active ? "Inativar" : "Ativar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (
                                      window.confirm(`Inativar ${seller.name}?`)
                                    )
                                      deleteSeller.mutate({ id: seller.id });
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                {seller.type === "EXTERNO" &&
                                  seller.accessToken && (
                                    <a
                                      href={`/vendedor/${encodeURIComponent(seller.accessToken)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum vendedor cadastrado.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Ranking por volume de vendas
                </CardTitle>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={rankingPeriod}
                  onChange={event =>
                    setRankingPeriod(event.target.value as RankingPeriod)
                  }
                >
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                  <option value="all">Todo o período</option>
                </select>
              </CardHeader>
              <CardContent>
                {rankingQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Calculando ranking…
                  </p>
                ) : rankingQuery.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-3">Posição</th>
                          <th className="px-3 py-3">Vendedor</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">
                            Volume vendido
                          </th>
                          <th className="px-3 py-3 text-right">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingQuery.data.map((row, index) => (
                          <tr
                            key={row.sellerId}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-3">
                              {index < 3 ? (
                                <Badge
                                  variant={
                                    index === 0 ? "default" : "secondary"
                                  }
                                  className="gap-1"
                                >
                                  <Trophy className="h-3 w-3" /> {index + 1}º
                                </Badge>
                              ) : (
                                `${index + 1}º`
                              )}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {row.sellerName}
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline">{row.status}</Badge>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold">
                              {fmt(Number(row.totalSold))}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {fmt(Number(row.totalCommission))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ainda não há vendas com comissão para este período.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comissoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <WalletCards className="h-4 w-4" /> Comissões
                </CardTitle>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={sellerFilter}
                  onChange={event => setSellerFilter(event.target.value)}
                >
                  <option value="TODOS">Todos os vendedores</option>
                  {(sellersQuery.data ?? []).map(seller => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent>
                {filteredCommissions.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-3">Pedido</th>
                          <th className="px-3 py-3">Vendedor</th>
                          <th className="px-3 py-3">Venda</th>
                          <th className="px-3 py-3">Custo</th>
                          <th className="px-3 py-3">Comissão</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCommissions.map(commission => (
                          <tr
                            key={commission.id}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-3 font-mono">
                              #{commission.orderId}
                            </td>
                            <td className="px-3 py-3">
                              {commission.sellerName}
                              <div className="font-mono text-xs text-muted-foreground">
                                {commission.referralCode}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {fmt(
                                Number(
                                  commission.saleAmount || commission.orderTotal
                                )
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {fmt(Number(commission.costAmount))}
                            </td>
                            <td className="px-3 py-3 font-semibold">
                              {fmt(
                                Number(
                                  commission.commissionAmount ||
                                    commission.commissionValue
                                )
                              )}
                              <div className="text-xs text-muted-foreground">
                                {commission.commissionRate
                                  ? `${Number(commission.commissionRate)}%`
                                  : "Fixa"}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                variant={
                                  commission.status === "PAGA" ||
                                  commission.status === "PAGO"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {commission.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {commission.status === "PENDENTE" && (
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  onClick={() =>
                                    markPaid.mutate({ id: commission.id })
                                  }
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Marcar
                                  pago
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma comissão encontrada.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Dialog
          open={Boolean(previewUrl)}
          onOpenChange={open => {
            if (!open) setPreviewUrl(null);
          }}
        >
          <DialogContent>
            <DialogTitle>Pré-visualização do documento</DialogTitle>
            <DialogDescription>
              Documento enviado na solicitação do vendedor.
            </DialogDescription>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Documento enviado"
                className="max-h-[70vh] w-full object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
