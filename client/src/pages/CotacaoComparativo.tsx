/**
 * client/src/pages/CotacaoComparativo.tsx
 *
 * Dashboard de comparativo — abas: Por Produto | Por Local | Melhor Local
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Trophy,
  MapPin,
  Package,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function BarraComparativa({
  valor,
  max,
  isMenor,
}: {
  valor: number;
  max: number;
  isMenor: boolean;
}) {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isMenor ? "bg-green-500" : "bg-primary/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-semibold min-w-20 text-right ${
          isMenor ? "text-green-700" : "text-foreground"
        }`}
      >
        {moeda(valor)}
      </span>
      {isMenor && (
        <Badge
          variant="outline"
          className="text-xs text-green-700 border-green-300 bg-green-50"
        >
          ★ menor
        </Badge>
      )}
    </div>
  );
}

export default function CotacaoComparativo() {
  const params = useParams<{ id: string }>();
  const sessaoId = Number(params.id);
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.cotacao.comparativo.useQuery({
    sessaoId,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
          <p>{error?.message ?? "Erro ao carregar comparativo"}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (data.porProduto.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/cotacoes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">{data.sessaoTitulo}</h1>
          </div>
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum preço coletado ainda</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/cotacoes/${sessaoId}/coletar`)}
            >
              Ir para coleta
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Locais qualificados no ranking
  const qualificados = data.ranking.filter((r) => !r.desqualificado);
  const maxCusto =
    qualificados.length > 0
      ? Math.max(...qualificados.map((r) => r.custoTotal))
      : 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/cotacoes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{data.sessaoTitulo}</h1>
              <p className="text-sm text-muted-foreground">
                {data.porProduto.length} produto
                {data.porProduto.length !== 1 ? "s" : ""} ·{" "}
                {data.porLocal.length} local
                {data.porLocal.length !== 1 ? "is" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/cotacoes/${sessaoId}/coletar`)}
          >
            Editar coleta
          </Button>
        </div>

        <Tabs defaultValue="melhor">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="melhor">
              <Trophy className="h-4 w-4 mr-1.5" />
              Melhor local
            </TabsTrigger>
            <TabsTrigger value="locais">
              <MapPin className="h-4 w-4 mr-1.5" />
              Por local
            </TabsTrigger>
            <TabsTrigger value="produtos">
              <Package className="h-4 w-4 mr-1.5" />
              Por produto
            </TabsTrigger>
          </TabsList>

          {/* Aba: Melhor local */}
          <TabsContent value="melhor" className="space-y-4 mt-4">
            {data.melhorLocal ? (
              <>
                {/* Card destaque */}
                <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardContent className="pt-6 text-center">
                    <Trophy className="h-12 w-12 mx-auto text-green-600 mb-3" />
                    <div className="text-2xl font-bold text-green-800">
                      {data.melhorLocal.localNome}
                    </div>
                    <div className="text-4xl font-bold text-green-700 mt-2">
                      {moeda(data.melhorLocal.custoTotal)}
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      Cesta + deslocamento
                    </div>
                    {data.melhorLocal.economiaVsMedia > 0 && (
                      <div className="mt-4 inline-flex items-center gap-1 bg-green-100 text-green-800 border border-green-200 rounded-full px-4 py-1.5 text-sm font-medium">
                        <TrendingDown className="h-4 w-4" />
                        Economia de{" "}
                        {moeda(data.melhorLocal.economiaVsMedia)} vs. média
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detalhes */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-lg font-bold">
                        {moeda(data.melhorLocal.totalCesta)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total da cesta
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-lg font-bold">
                        {moeda(data.melhorLocal.custoOperacional)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deslocamento
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-lg font-bold">
                        {data.melhorLocal.produtosEncontrados}/
                        {data.melhorLocal.produtosTotais}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Produtos encontrados
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-lg font-bold text-amber-600">
                        #{1}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Posição no ranking
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                <p>Nenhum local qualificado. Verifique os dados coletados.</p>
              </div>
            )}
          </TabsContent>

          {/* Aba: Por local */}
          <TabsContent value="locais" className="space-y-3 mt-4">
            {data.ranking.map((local, i) => (
              <Card
                key={local.localId}
                className={`${
                  local.desqualificado
                    ? "opacity-60 border-dashed"
                    : i === 0
                    ? "border-green-300"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        local.desqualificado
                          ? "bg-muted text-muted-foreground"
                          : i === 0
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {local.desqualificado ? "✗" : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {local.localNome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {local.produtosEncontrados}/{local.produtosTotais}{" "}
                        encontrados
                        {local.desqualificado && (
                          <span className="text-red-600 ml-2">
                            — desqualificado (produtos obrigatórios ausentes)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">
                        {local.desqualificado ? "—" : moeda(local.custoTotal)}
                      </div>
                      <div className="text-xs text-muted-foreground">total</div>
                    </div>
                  </div>

                  {!local.desqualificado && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Cesta</span>
                        <span>{moeda(local.totalCesta)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Deslocamento</span>
                        <span>{moeda(local.custoOperacional)}</span>
                      </div>
                      {/* Barra comparativa */}
                      <div className="pt-1">
                        <BarraComparativa
                          valor={local.custoTotal}
                          max={maxCusto}
                          isMenor={i === 0}
                        />
                      </div>
                    </div>
                  )}

                  {local.produtosObrigatoriosAusentes.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                      Ausentes: {local.produtosObrigatoriosAusentes.join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Aba: Por produto */}
          <TabsContent value="produtos" className="space-y-4 mt-4">
            {data.porProduto.map((prod) => {
              const precosValidos = prod.precos.filter(
                (p) => p.encontrado && p.precoUnitario != null
              );
              const maxPreco =
                precosValidos.length > 0
                  ? Math.max(...precosValidos.map((p) => p.precoUnitario!))
                  : 0;

              return (
                <Card key={prod.sessaoProdutoId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{prod.produtoNome}</CardTitle>
                      <div className="flex gap-2">
                        {prod.obrigatorio && (
                          <Badge
                            variant="outline"
                            className="text-xs text-amber-700 border-amber-300"
                          >
                            ★ obrigatório
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {prod.quantidade} {/* unidade */}
                        </Badge>
                      </div>
                    </div>
                    {prod.menorPreco != null && (
                      <div className="text-sm text-green-700 font-medium">
                        Menor preço: {moeda(prod.menorPreco)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {prod.precos.map((p) => (
                      <div key={p.localId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate max-w-36">
                            {p.localNome}
                          </span>
                          {!p.encontrado ? (
                            <span className="text-xs text-muted-foreground">
                              Não encontrado
                            </span>
                          ) : p.precoUnitario == null ? (
                            <span className="text-xs text-muted-foreground">
                              Sem preço
                            </span>
                          ) : (
                            <BarraComparativa
                              valor={p.precoUnitario}
                              max={maxPreco}
                              isMenor={p.localId === prod.menorPrecoLocalId}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {precosValidos.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        Nenhum preço coletado ainda
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
