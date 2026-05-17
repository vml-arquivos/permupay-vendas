import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Trash2, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: unknown): string => {
  const n = Number(v);
  return isNaN(n) ? "—" : formatCurrency(n);
};

const fmtPct = (v: unknown): string => {
  const n = Number(v);
  return isNaN(n) ? "—" : `${n.toFixed(2)}%`;
};

const DIAGNOSIS_STYLES: Record<string, string> = {
  EXCELENTE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SAUDAVEL: "bg-green-100 text-green-700 border-green-200",
  ATENCAO: "bg-yellow-100 text-yellow-700 border-yellow-200",
  RISCO: "bg-orange-100 text-orange-700 border-orange-200",
  PREJUIZO: "bg-red-100 text-red-700 border-red-200",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  DEBITO: "Débito",
  CREDITO_A_VISTA: "Crédito à Vista",
  CREDITO_PARCELADO: "Crédito Parcelado",
};

// ─── Extrai dados de uma simulação para exibição na tabela ────────────────────
function extractSimRow(sim: any) {
  const product = sim.productSnapshot || {};
  const result = sim.resultSnapshot || {};
  const results: any[] = result.results || [];

  // Encontrar resultados por método
  const byMethod = (method: string) => results.find((r: any) => r.method === method) || null;

  const pix = byMethod("PIX");
  const boletoRes = byMethod("BOLETO");
  // Cartão: tentar CREDITO_PARCELADO primeiro, depois CREDITO_A_VISTA
  const cardRes = byMethod("CREDITO_PARCELADO") || byMethod("CREDITO_A_VISTA") || byMethod("DEBITO");

  // Coluna "Impostos" — soma do totalTax do melhor método ou resultado do PIX
  const bestResult = results.find((r: any) => r.method === sim.bestPaymentMethod) || pix || results[0];

  return {
    nome: sim.name,
    produto: product.productName || product.name || "—",
    precoCusto: product.costPrice ?? product.finalUnitCostBrl ?? 0,
    precoVenda: sim.recommendedPrice ?? 0,
    margemLucro: (sim.desiredMarginRate ?? 0) * 100,          // armazenado 0–1 no banco
    lucroLiquido: sim.netProfit ?? bestResult?.netProfit ?? 0,
    impostos: bestResult?.totalTax ?? 0,
    // PIX
    valorAVista: pix?.suggestedPrice ?? 0,
    // Cartão
    jurosCartao: cardRes?.totalFees ?? cardRes?.totalInterest ?? 0,
    valorParcelaCartao: cardRes?.installmentValue ?? cardRes?.suggestedPrice ?? 0,
    // Boleto
    jurosBoleto: boletoRes?.totalFees ?? boletoRes?.totalInterest ?? 0,
    valorParcelaBoleto: boletoRes?.installmentValue ?? boletoRes?.suggestedPrice ?? 0,
    // Extras para exibição
    diagnosis: sim.diagnosis || "—",
    bestMethod: sim.bestPaymentMethod || "—",
    createdAt: new Date(sim.createdAt).toLocaleDateString("pt-BR"),
    id: sim.id,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimulationsExport() {
  const utils = trpc.useUtils();
  const { data: simulations = [], isLoading } = trpc.simulations.list.useQuery();

  const deleteSimulation = trpc.simulations.delete.useMutation({
    onSuccess: () => {
      utils.simulations.list.invalidate();
      toast.success("Simulação deletada.");
    },
  });

  const rows = (simulations as any[]).map(extractSimRow);

  const exportToExcel = () => {
    if (rows.length === 0) {
      toast.error("Nenhuma simulação para exportar");
      return;
    }

    const sheetRows = rows.map((r) => ({
      "Nome da Simulação": r.nome,
      "Produto": r.produto,
      "Preço de Custo (R$)": r.precoCusto,
      "Preço de Venda (R$)": r.precoVenda,
      "Margem de Lucro (%)": r.margemLucro,
      "Lucro Líquido (R$)": r.lucroLiquido,
      "Impostos (R$)": r.impostos,
      "Valor à Vista / PIX (R$)": r.valorAVista,
      "Custos/Juros Cartão (R$)": r.jurosCartao,
      "Valor da Parcela Cartão (R$)": r.valorParcelaCartao,
      "Custos/Juros Boleto (R$)": r.jurosBoleto,
      "Valor da Parcela Boleto (R$)": r.valorParcelaBoleto,
      "Diagnóstico": r.diagnosis,
      "Melhor Pagamento": METHOD_LABEL[r.bestMethod] || r.bestMethod,
      "Data": r.createdAt,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [
      { wch: 28 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
      { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulações");
    XLSX.writeFile(wb, `simulacoes-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`Planilha exportada com ${rows.length} simulação(ões)!`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulações Salvas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Relatório completo de precificação por produto
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={exportToExcel}
              disabled={rows.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <Link href="/simulador">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Simulação
              </Button>
            </Link>
          </div>
        </div>

        {/* Estado vazio */}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma simulação salva
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crie uma simulação de precificação para ela aparecer aqui
            </p>
            <Link href="/simulador">
              <Button>Criar Simulação</Button>
            </Link>
          </div>
        )}

        {/* Tabela de simulações */}
        {rows.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Simulação / Produto</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Preço Custo</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Preço Venda</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Margem %</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lucro Líq.</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Impostos</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Valor à Vista</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Juros Cartão</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Parcela Cartão</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Juros Boleto</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Parcela Boleto</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Diagnóstico</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                      }`}
                    >
                      {/* Simulação / Produto */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-medium text-foreground leading-tight">{r.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                          {r.produto}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{r.createdAt}</p>
                      </td>

                      {/* Preço de Custo */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">{fmt(r.precoCusto)}</span>
                      </td>

                      {/* Preço de Venda */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-medium text-foreground">{fmt(r.precoVenda)}</span>
                      </td>

                      {/* Margem % */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">{fmtPct(r.margemLucro)}</span>
                      </td>

                      {/* Lucro Líquido */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={
                            Number(r.lucroLiquido) < 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          {fmt(r.lucroLiquido)}
                        </span>
                      </td>

                      {/* Impostos */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">{fmt(r.impostos)}</span>
                      </td>

                      {/* Valor à Vista (PIX) */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">
                          {r.valorAVista > 0 ? fmt(r.valorAVista) : "—"}
                        </span>
                      </td>

                      {/* Custos/Juros Cartão */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">
                          {r.jurosCartao > 0 ? fmt(r.jurosCartao) : "—"}
                        </span>
                      </td>

                      {/* Valor da Parcela Cartão */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">
                          {r.valorParcelaCartao > 0 ? fmt(r.valorParcelaCartao) : "—"}
                        </span>
                      </td>

                      {/* Custos/Juros Boleto */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">
                          {r.jurosBoleto > 0 ? fmt(r.jurosBoleto) : "—"}
                        </span>
                      </td>

                      {/* Valor da Parcela Boleto */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-foreground">
                          {r.valorParcelaBoleto > 0 ? fmt(r.valorParcelaBoleto) : "—"}
                        </span>
                      </td>

                      {/* Diagnóstico */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${DIAGNOSIS_STYLES[r.diagnosis] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                        >
                          {r.diagnosis}
                        </Badge>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Deletar esta simulação?")) {
                              deleteSimulation.mutate({ id: r.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé com totais */}
            <div className="bg-muted/40 border-t border-border px-4 py-3 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{rows.length}</strong> simulação(ões)
              </span>
              <span>
                Preço médio:{" "}
                <strong className="text-foreground">
                  {fmt(rows.reduce((s, r) => s + r.precoVenda, 0) / rows.length)}
                </strong>
              </span>
              <span>
                Margem média:{" "}
                <strong className="text-foreground">
                  {fmtPct(rows.reduce((s, r) => s + r.margemLucro, 0) / rows.length)}
                </strong>
              </span>
              <span>
                Lucro total:{" "}
                <strong className={rows.reduce((s, r) => s + r.lucroLiquido, 0) >= 0 ? "text-green-600" : "text-red-600"}>
                  {fmt(rows.reduce((s, r) => s + r.lucroLiquido, 0))}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
