/**
 * client/src/pages/Cotacoes.tsx
 *
 * Módulo de Cotação de Preços — tela principal com lista de sessões.
 * Inclui DashboardLayout internamente (padrão: usa wrapper P no App.tsx).
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Plus,
  MapPin,
  MoreVertical,
  BarChart3,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  em_andamento: {
    label: "Em andamento",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  concluida: {
    label: "Concluída",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  cancelada: {
    label: "Cancelada",
    icon: XCircle,
    className: "bg-red-100 text-red-800 border-red-200",
  },
} as const;

export default function Cotacoes() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: sessoes, isLoading } = trpc.cotacao.sessoes.listar.useQuery();
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();

  const removerSessao = trpc.cotacao.sessoes.remover.useMutation({
    onSuccess: () => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Sessão removida");
    },
    onError: (err) => toast.error(err.message),
  });

  const atualizarStatus = trpc.cotacao.sessoes.atualizar.useMutation({
    onSuccess: () => {
      utils.cotacao.sessoes.listar.invalidate();
      toast.success("Status atualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Cotações de Preços
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Pesquise preços em campo e compare fornecedores
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/cotacoes/locais")}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Locais ({locais?.length ?? 0})
            </Button>
            <Button onClick={() => navigate("/cotacoes/nova")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cotação
            </Button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{sessoes?.length ?? 0}</div>
              <div className="text-sm text-muted-foreground">Total de sessões</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">
                {sessoes?.filter((s) => s.status === "em_andamento").length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">Em andamento</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">
                {locais?.length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">Locais cadastrados</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de sessões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessões recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !sessoes || sessoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma cotação ainda</p>
                <p className="text-sm mt-1">
                  Crie sua primeira sessão para começar a pesquisar preços
                </p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/cotacoes/nova")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Cotação
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessoes.map((sessao) => {
                  const cfg = STATUS_CONFIG[sessao.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={sessao.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/40 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {sessao.titulo}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${cfg.className}`}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {(sessao as any).totalProdutos ?? 0} produto
                            {((sessao as any).totalProdutos ?? 0) !== 1
                              ? "s"
                              : ""}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(sessao.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sessao.status !== "cancelada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/cotacoes/${sessao.id}/comparativo`)
                            }
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Comparar
                          </Button>
                        )}
                        {sessao.status === "em_andamento" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate(`/cotacoes/${sessao.id}/coletar`)
                            }
                          >
                            Coletar
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/cotacoes/${sessao.id}/editar`)
                              }
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {sessao.status === "em_andamento" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  atualizarStatus.mutate({
                                    id: sessao.id,
                                    status: "concluida",
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Concluir
                              </DropdownMenuItem>
                            )}
                            {sessao.status === "concluida" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  atualizarStatus.mutate({
                                    id: sessao.id,
                                    status: "em_andamento",
                                  })
                                }
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Reabrir
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Excluir sessão?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todos os preços coletados nesta sessão serão
                                    removidos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() =>
                                      removerSessao.mutate({ id: sessao.id })
                                    }
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
