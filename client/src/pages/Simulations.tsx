import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Eye, Plus, AlertCircle } from "lucide-react";

export default function Simulations() {
  const utils = trpc.useUtils();
  const { data: simulations = [] } = trpc.simulations.list.useQuery();

  const delete_mutation = trpc.simulations.delete.useMutation({
    onSuccess: () => utils.simulations.list.invalidate(),
  });

  const duplicate = trpc.simulations.duplicate.useMutation({
    onSuccess: () => utils.simulations.list.invalidate(),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Simulações</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Visualize e gerencie suas simulações de precificação
              </p>
            </div>
            <Link href="/simulador">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Simulação
              </Button>
            </Link>
          </div>

          {/* Lista de simulações */}
          {simulations.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma simulação salva
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Crie sua primeira simulação de precificação
              </p>
              <Link href="/simulador">
                <Button>Criar Simulação</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {simulations.map((sim: any) => {
                const createdAt = new Date(sim.createdAt).toLocaleDateString("pt-BR");
                const diagnosticColor =
                  sim.diagnosis === "SAUDAVEL"
                    ? "text-success"
                    : sim.diagnosis === "ATENCAO"
                    ? "text-warning"
                    : sim.diagnosis === "RISCO"
                    ? "text-orange-500"
                    : "text-danger";

                return (
                  <div
                    key={sim.id}
                    className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {sim.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Criado em: {createdAt}
                        </p>
                      </div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${diagnosticColor}`}
                      >
                        {sim.diagnosis || "—"}
                      </span>
                    </div>

                    {/* Informações principais */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/30 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Preço Recomendado</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(sim.recommendedPrice || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margem Desejada</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatPercent(sim.desiredMarginRate || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Melhor Forma</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sim.bestPaymentMethod || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pior Forma</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sim.worstPaymentMethod || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Link href={`/simulacoes/${sim.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          Ver Detalhes
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => duplicate.mutate({ id: sim.id })}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-danger hover:text-danger ml-auto"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja deletar esta simulação?")) {
                            delete_mutation.mutate({ id: sim.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Deletar
                      </Button>
                    </div>
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
