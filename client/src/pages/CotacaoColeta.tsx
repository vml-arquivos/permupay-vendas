/**
 * client/src/pages/CotacaoColeta.tsx
 *
 * Interface de coleta de preços em campo — otimizada para mobile.
 * Auto-save, progresso por local, troca rápida de local.
 */

import { useState, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Circle,
  Camera,
  Plus,
  ChevronDown,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useCotacaoOffline } from "@/hooks/useCotacaoOffline";

// Mapa de preços local para input controlado
type PrecoMap = Record<string, string>; // key: `${sessaoProdutoId}-${localId}`

export default function CotacaoColeta() {
  const params = useParams<{ id: string }>();
  const sessaoId = Number(params.id);
  const [, navigate] = useLocation();

  const [localIdSelecionado, setLocalIdSelecionado] = useState<number | null>(null);
  const [precos, setPrecos] = useState<PrecoMap>({});
  const [naoEncontrados, setNaoEncontrados] = useState<Set<string>>(new Set());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const utils = trpc.useUtils();

  // Dados da sessão e locais
  const { data: sessao, isLoading } = trpc.cotacao.sessoes.obter.useQuery(
    { id: sessaoId },
    {
      onSuccess: (data) => {
        // Nenhum local selecionado ainda — seleciona o primeiro se disponível
        if (!localIdSelecionado && locais && locais.length > 0) {
          setLocalIdSelecionado(locais[0].id);
        }
      },
    }
  );
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();
  const { data: precosExistentes } = trpc.cotacao.precos.listarSessao.useQuery(
    { sessaoId },
    {
      onSuccess: (data) => {
        // Preenche map com preços já salvos
        const novoMap: PrecoMap = {};
        const novosNaoEncontrados = new Set<string>();
        for (const p of data) {
          const key = `${p.sessaoProdutoId}-${p.localId}`;
          novoMap[key] =
            p.precoUnitario != null ? String(p.precoUnitario) : "";
          if (!p.encontrado) novosNaoEncontrados.add(key);
        }
        setPrecos(novoMap);
        setNaoEncontrados(novosNaoEncontrados);
      },
    }
  );

  // Hook offline
  const { isOnline, pendingCount, syncNow } = useCotacaoOffline(sessaoId);

  // Mutation de salvar preço
  const registrar = trpc.cotacao.precos.registrar.useMutation({
    onSuccess: () => {
      utils.cotacao.precos.listarSessao.invalidate({ sessaoId });
    },
    onError: (err) => {
      toast.error("Erro ao salvar preço: " + err.message);
    },
  });

  // Auto-save com debounce
  const autoSave = useCallback(
    (
      sessaoProdutoId: number,
      localId: number,
      valor: string,
      encontrado: boolean
    ) => {
      const key = `${sessaoProdutoId}-${localId}`;
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        const preco = parseFloat(valor);
        if (encontrado && (isNaN(preco) || preco < 0)) return;
        registrar.mutate({
          sessaoId,
          sessaoProdutoId,
          localId,
          precoUnitario: encontrado ? (isNaN(preco) ? null : preco) : null,
          encontrado,
        });
        // Feedback tátil
        if ("vibrate" in navigator) navigator.vibrate(30);
        toast.success("Preço salvo", { duration: 1000, position: "bottom-center" });
      }, 700);
    },
    [sessaoId, registrar]
  );

  function handlePrecoChange(
    sessaoProdutoId: number,
    localId: number,
    valor: string
  ) {
    const key = `${sessaoProdutoId}-${localId}`;
    setPrecos((prev) => ({ ...prev, [key]: valor }));
    const encontrado = !naoEncontrados.has(key);
    autoSave(sessaoProdutoId, localId, valor, encontrado);
  }

  function toggleNaoEncontrado(sessaoProdutoId: number, localId: number) {
    const key = `${sessaoProdutoId}-${localId}`;
    const atual = naoEncontrados.has(key);
    if (atual) {
      setNaoEncontrados((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setNaoEncontrados((prev) => new Set([...prev, key]));
    }
    autoSave(sessaoProdutoId, localId, precos[key] ?? "", !atual);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  if (!sessao) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">
          Sessão não encontrada
        </div>
      </DashboardLayout>
    );
  }

  const localAtual = locais?.find((l) => l.id === localIdSelecionado);
  const produtos = sessao.produtos ?? [];

  // Cálculo de progresso no local atual
  const cotadosNoLocal = localIdSelecionado
    ? produtos.filter((p) => {
        const key = `${p.id}-${localIdSelecionado}`;
        return (
          precos[key] !== undefined &&
          precos[key] !== "" &&
          !naoEncontrados.has(key)
        );
      }).length +
      [...naoEncontrados].filter((k) =>
        k.endsWith(`-${localIdSelecionado}`)
      ).length
    : 0;
  const progressoPct =
    produtos.length > 0 ? (cotadosNoLocal / produtos.length) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto">
        {/* Header fixo */}
        <div className="px-4 pt-4 pb-3 border-b bg-background sticky top-0 z-10 space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/cotacoes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold truncate">{sessao.titulo}</h1>
            </div>
            {/* Status offline */}
            {!isOnline ? (
              <Badge
                variant="outline"
                className="text-amber-700 border-amber-300 bg-amber-50 text-xs gap-1"
              >
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            ) : pendingCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1"
                onClick={syncNow}
              >
                <RefreshCw className="h-3 w-3" />
                Sync ({pendingCount})
              </Button>
            ) : null}
          </div>

          {/* Seletor de local */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={localIdSelecionado?.toString() ?? ""}
              onValueChange={(v) => setLocalIdSelecionado(Number(v))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um local..." />
              </SelectTrigger>
              <SelectContent>
                {locais?.map((l) => (
                  <SelectItem key={l.id} value={l.id.toString()}>
                    {l.nome}
                    {l.tipoComercio && (
                      <span className="text-muted-foreground text-xs ml-1">
                        — {l.tipoComercio}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/cotacoes/locais")}
              title="Gerenciar locais"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Barra de progresso */}
          {localIdSelecionado && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {cotadosNoLocal}/{produtos.length} produtos pesquisados
                </span>
                <span>{Math.round(progressoPct)}%</span>
              </div>
              <Progress value={progressoPct} className="h-2" />
            </div>
          )}
        </div>

        {/* Lista de produtos */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-6">
          {!localIdSelecionado ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Selecione um local para começar a coletar preços</p>
              {(!locais || locais.length === 0) && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => navigate("/cotacoes/locais")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeiro local
                </Button>
              )}
            </div>
          ) : (
            <>
              {produtos.map((p) => {
                const key = `${p.id}-${localIdSelecionado}`;
                const valor = precos[key] ?? "";
                const naoAchado = naoEncontrados.has(key);
                const cotado =
                  (valor !== "" && !naoAchado) || naoAchado;

                return (
                  <Card
                    key={p.id}
                    className={`transition-colors ${
                      cotado
                        ? "border-green-200 bg-green-50/50"
                        : "border-border"
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Ícone de status */}
                        <div className="mt-1 shrink-0">
                          {cotado ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Nome do produto */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">
                            {p.produtoNome}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.quantidade} {p.unidade}
                            {p.obrigatorio && (
                              <span className="ml-1 text-amber-600">
                                ★ obrigatório
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Campo de preço */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!naoAchado && (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                R$
                              </span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                placeholder="0,00"
                                value={valor}
                                onChange={(e) =>
                                  handlePrecoChange(
                                    p.id,
                                    localIdSelecionado,
                                    e.target.value
                                  )
                                }
                                className="pl-8 w-28 text-right text-base font-semibold h-10"
                              />
                            </div>
                          )}

                          {/* Botão câmera */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 text-muted-foreground"
                            title="Fotografar preço"
                            onClick={() =>
                              toast.info(
                                "Funcionalidade de câmera disponível no app instalado"
                              )
                            }
                          >
                            <Camera className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      {/* Toggle "Não encontrado" */}
                      <div className="mt-2 flex justify-end">
                        <button
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                            naoAchado
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() =>
                            toggleNaoEncontrado(p.id, localIdSelecionado)
                          }
                        >
                          {naoAchado ? "✗ Não encontrado" : "Marcar como não encontrado"}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Botão concluir local */}
              {progressoPct === 100 && (
                <div className="pt-2 text-center">
                  <div className="text-green-600 font-medium text-sm mb-3">
                    ✓ Todos os produtos pesquisados neste local!
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/cotacoes/${sessaoId}/comparativo`)}
                  >
                    <BarChart3Icon />
                    Ver comparativo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Ícone auxiliar
function BarChart3Icon() {
  return (
    <svg
      className="h-4 w-4 mr-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
