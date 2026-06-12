/**
 * CotacaoComparativo.tsx — Dashboard comparativo de preços
 * PWA mobile-first com abas: Melhor Local / Por Local / Por Produto
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Trophy, MapPin, Package, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, ChevronRight, BarChart3,
} from "lucide-react";
import { useState } from "react";

const R$ = (v: number) => v === Infinity ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Tab = "melhor" | "locais" | "produtos";

export default function CotacaoComparativo() {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);
  const [, nav] = useLocation();
  const [tab, setTab] = useState<Tab>("melhor");

  const { data, isLoading, error } = trpc.cotacao.comparativo.useQuery({ sessaoId });

  if (isLoading) return (
    <div className="min-h-svh bg-gray-50 max-w-md mx-auto p-4 space-y-3">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
      <AlertTriangle className="h-10 w-10" />
      <p className="text-center">{error?.message ?? "Erro ao carregar comparativo"}</p>
    </div>
  );

  const qualif = data.ranking.filter(r => !r.desqualificado);
  const maxCusto = qualif.length > 0 ? Math.max(...qualif.map(r => r.custoTotal)) : 0;

  return (
    <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => nav("/cotacoes")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{data.sessaoTitulo}</p>
            <p className="text-xs opacity-60">
              {data.porProduto.length} produtos · {data.porLocal.length} locais
            </p>
          </div>
          <button
            onClick={() => nav(`/cotacoes/${sessaoId}/coletar`)}
            className="text-xs bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            Editar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 pb-0">
          {([
            { key: "melhor",   label: "🏆 Melhor" },
            { key: "locais",   label: "📍 Locais" },
            { key: "produtos", label: "📦 Produtos" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-xs font-semibold py-2.5 rounded-t-xl transition-colors ${
                tab === t.key ? "bg-gray-50 text-[oklch(0.30_0.13_240)]" : "text-white/70 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto pb-6">

        {/* ── Aba: Melhor local ── */}
        {tab === "melhor" && (
          <div className="px-4 py-4 space-y-3">
            {data.melhorLocal ? (
              <>
                {/* Card vencedor */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-5 text-white text-center shadow-lg">
                  <div className="text-4xl mb-1">🏆</div>
                  <p className="text-sm font-medium opacity-80 mb-1">Melhor opção</p>
                  <p className="text-2xl font-bold">{data.melhorLocal.localNome}</p>
                  <p className="text-4xl font-black mt-3 tracking-tight">{R$(data.melhorLocal.custoTotal)}</p>
                  <p className="text-xs opacity-70 mt-1">cesta + deslocamento</p>
                  {data.melhorLocal.economiaVsMedia > 0.01 && (
                    <div className="mt-4 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
                      <TrendingDown className="h-4 w-4" />
                      Economia de {R$(data.melhorLocal.economiaVsMedia)} vs. média
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Cesta" value={R$(data.melhorLocal.totalCesta)} />
                  <StatBox label="Deslocamento" value={R$(data.melhorLocal.custoOperacional)} />
                  <StatBox
                    label="Produtos encontrados"
                    value={`${data.melhorLocal.produtosEncontrados}/${data.melhorLocal.produtosTotais}`}
                  />
                  <StatBox label="Posição" value="#1" highlight />
                </div>

                {/* Ranking resumido */}
                {qualif.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking completo</p>
                    </div>
                    {data.ranking.map((r, i) => (
                      <div key={r.localId} className={`flex items-center gap-3 px-4 py-3 ${i < data.ranking.length - 1 ? "border-b border-gray-50" : ""}`}>
                        <span className={`text-sm font-bold w-6 text-center ${r.desqualificado ? "text-muted-foreground" : i === 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {r.desqualificado ? "✗" : `#${i + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.localNome}</p>
                          {r.desqualificado && <p className="text-xs text-red-500">Produto obrigatório ausente</p>}
                        </div>
                        <span className={`text-sm font-bold ${r.desqualificado ? "text-muted-foreground" : i === 0 ? "text-emerald-600" : "text-foreground"}`}>
                          {r.desqualificado ? "—" : R$(r.custoTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyComparativo onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
            )}
          </div>
        )}

        {/* ── Aba: Por local ── */}
        {tab === "locais" && (
          <div className="px-4 py-4 space-y-3">
            {data.ranking.length === 0 ? (
              <EmptyComparativo onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
            ) : data.ranking.map((local, i) => (
              <div key={local.localId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${local.desqualificado ? "opacity-60 border-dashed border-gray-200" : i === 0 ? "border-emerald-300" : "border-gray-100"}`}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      local.desqualificado ? "bg-gray-100 text-gray-400" :
                      i === 0 ? "bg-emerald-100 text-emerald-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {local.desqualificado ? "✗" : `#${i+1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm">{local.localNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {local.produtosEncontrados}/{local.produtosTotais} produtos
                        {local.desqualificado && <span className="text-red-500 ml-1">· desqualificado</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-base ${i === 0 && !local.desqualificado ? "text-emerald-600" : ""}`}>
                        {local.desqualificado ? "—" : R$(local.custoTotal)}
                      </p>
                    </div>
                  </div>

                  {!local.desqualificado && (
                    <>
                      <div className="space-y-1 text-xs text-muted-foreground mb-3">
                        <div className="flex justify-between">
                          <span>Cesta de produtos</span>
                          <span className="font-medium text-foreground">{R$(local.totalCesta)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Custo deslocamento</span>
                          <span className="font-medium text-foreground">{R$(local.custoOperacional)}</span>
                        </div>
                      </div>
                      {/* Barra proporcional */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : "bg-primary/60"}`}
                            style={{ width: `${maxCusto > 0 ? (local.custoTotal / maxCusto) * 100 : 0}%` }}
                          />
                        </div>
                        {i === 0 && (
                          <span className="text-xs font-semibold text-emerald-600 shrink-0">★ menor</span>
                        )}
                      </div>
                    </>
                  )}

                  {local.produtosObrigatoriosAusentes.length > 0 && (
                    <div className="mt-2 bg-red-50 rounded-xl px-3 py-2 text-xs text-red-600">
                      Faltam: {local.produtosObrigatoriosAusentes.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Aba: Por produto ── */}
        {tab === "produtos" && (
          <div className="px-4 py-4 space-y-3">
            {data.porProduto.length === 0 ? (
              <EmptyComparativo onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
            ) : data.porProduto.map(prod => {
              const validos = prod.precos.filter(p => p.encontrado && p.precoUnitario != null);
              const max = validos.length > 0 ? Math.max(...validos.map(p => p.precoUnitario!)) : 0;

              return (
                <div key={prod.sessaoProdutoId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate flex-1">{prod.produtoNome}</p>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {prod.obrigatorio && <span className="text-xs text-amber-600 font-medium">★</span>}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{prod.quantidade} un</span>
                      </div>
                    </div>
                    {prod.menorPreco != null && (
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                        Menor preço: {R$(prod.menorPreco)}
                      </p>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {prod.precos.map(p => (
                      <div key={p.localId} className={`flex items-center gap-3 px-4 py-2.5 ${p.localId === prod.menorPrecoLocalId ? "bg-emerald-50" : ""}`}>
                        <div className="w-2 h-2 rounded-full shrink-0 bg-gray-200" />
                        <p className="text-sm flex-1 truncate">{p.localNome}</p>
                        {!p.encontrado ? (
                          <span className="text-xs text-muted-foreground">Não encontrado</span>
                        ) : p.precoUnitario == null ? (
                          <span className="text-xs text-muted-foreground">Sem preço</span>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${p.localId === prod.menorPrecoLocalId ? "bg-emerald-500" : "bg-primary/60"}`}
                                style={{ width: `${max > 0 ? (p.precoUnitario / max) * 100 : 0}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold min-w-[60px] text-right ${p.localId === prod.menorPrecoLocalId ? "text-emerald-600" : ""}`}>
                              {R$(p.precoUnitario)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? "bg-emerald-50 border border-emerald-200" : "bg-white border border-gray-100"} shadow-sm`}>
      <p className={`text-xl font-bold ${highlight ? "text-emerald-700" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function EmptyComparativo({ onColetar }: { onColetar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p className="font-semibold">Nenhum preço coletado ainda</p>
        <p className="text-sm text-muted-foreground mt-1">Vá a campo e registre os preços</p>
      </div>
      <button onClick={onColetar} className="mt-2 px-6 py-3 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold text-sm">
        Ir para coleta →
      </button>
    </div>
  );
}
