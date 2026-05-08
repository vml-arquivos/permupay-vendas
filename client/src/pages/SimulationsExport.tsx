import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Download, Eye, Trash2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

export default function SimulationsExport() {
  const utils = trpc.useUtils();
  const { data: simulations = [] } = trpc.simulations.list.useQuery();
  const deleteSimulation = trpc.simulations.delete.useMutation({
    onSuccess: () => {
      utils.simulations.list.invalidate();
    },
  });

  const exportToExcel = () => {
    if (simulations.length === 0) {
      alert("Nenhuma simulação para exportar");
      return;
    }

    // Montar linhas da planilha
    const rows = simulations.map((sim: any) => {
      const product = sim.productSnapshot || {};
      return {
        "Nome da Simulação": sim.name,
        "Produto": product.productName || "—",
        "Categoria": product.category || "—",
        "Preço de Custo": product.costPrice || 0,
        "Margem Desejada (%)": (sim.desiredMarginRate || 0) * 100,
        "Preço Recomendado": sim.recommendedPrice || 0,
        "Preço Mínimo": sim.minimumBreakEvenPrice || 0,
        "Melhor Forma de Pagamento": sim.bestPaymentMethod || "—",
        "Pior Forma de Pagamento": sim.worstPaymentMethod || "—",
        "Diagnóstico": sim.diagnosis || "—",
        "Data de Criação": new Date(sim.createdAt).toLocaleDateString("pt-BR"),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Larguras das colunas
    ws["!cols"] = [
      { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 26 }, { wch: 14 }, { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulações");

    XLSX.writeFile(wb, `simulacoes-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Simulações Salvas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie e exporte suas simulações de precificação
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={exportToExcel}
                disabled={simulations.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar para Excel
              </Button>
              <Link href="/simulador">
                <Button className="gap-2">Nova Simulação</Button>
              </Link>
            </div>
          </div>

          {/* Lista de simulações */}
          {simulations.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma simulação salva
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece criando uma nova simulação de precificação
              </p>
              <Link href="/simulador">
                <Button>Criar Simulação</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {simulations.map((sim: any) => {
                const product = sim.productSnapshot || {};
                const createdAt = new Date(sim.createdAt).toLocaleDateString("pt-BR");

                return (
                  <div
                    key={sim.id}
                    className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {sim.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Produto: <span className="text-foreground">{product.productName || "—"}</span>
                          {" • "}
                          Categoria: <span className="text-foreground">{product.category || "—"}</span>
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Custo: </span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(product.costPrice || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Margem: </span>
                            <span className="font-medium text-foreground">
                              {formatPercent(sim.desiredMarginRate || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Preço Recomendado: </span>
                            <span className="font-medium text-success">
                              {formatCurrency(sim.recommendedPrice || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Diagnóstico: </span>
                            <span
                              className={`font-medium ${
                                sim.diagnosis === "SAUDAVEL"
                                  ? "text-success"
                                  : sim.diagnosis === "ATENCAO"
                                  ? "text-warning"
                                  : sim.diagnosis === "RISCO"
                                  ? "text-orange-500"
                                  : "text-danger"
                              }`}
                            >
                              {sim.diagnosis || "—"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Criado em: {createdAt}
                        </p>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Link href={`/simulacoes/${sim.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-danger hover:text-danger"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar esta simulação?")) {
                              deleteSimulation.mutate({ id: sim.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Deletar
                        </Button>
                      </div>
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
