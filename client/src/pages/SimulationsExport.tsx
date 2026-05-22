import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Trash2, AlertCircle, FileText } from "lucide-react";
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

const DIAGNOSIS_COLOR: Record<string, string> = {
  EXCELENTE: "#059669", SAUDAVEL: "#16a34a",
  ATENCAO: "#ca8a04", RISCO: "#ea580c", PREJUIZO: "#dc2626",
};

const DIAGNOSIS_BG: Record<string, string> = {
  EXCELENTE: "#ecfdf5", SAUDAVEL: "#f0fdf4",
  ATENCAO: "#fefce8", RISCO: "#fff7ed", PREJUIZO: "#fef2f2",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX", BOLETO: "Boleto", DEBITO: "Débito",
  CREDITO_A_VISTA: "Crédito à Vista", CREDITO_PARCELADO: "Crédito Parcelado",
};

// ─── Extrai dados de uma simulação ───────────────────────────────────────────
function extractSimRow(sim: any) {
  const product = sim.productSnapshot || {};
  const result = sim.resultSnapshot || {};
  const results: any[] = result.results || [];

  const byMethod = (method: string) => results.find((r: any) => r.method === method) || null;

  const pix      = byMethod("PIX");
  const boletoRes = byMethod("BOLETO");
  const cardRes  = byMethod("CREDITO_PARCELADO") || byMethod("CREDITO_A_VISTA") || byMethod("DEBITO");
  const bestResult = results.find((r: any) => r.method === sim.bestPaymentMethod) || pix || results[0];

  return {
    nome: sim.name,
    produto: product.productName || product.name || "—",
    categoria: product.category || "—",
    precoCusto: product.costPrice ?? product.finalUnitCostBrl ?? 0,
    precoVenda: sim.recommendedPrice ?? 0,
    margemLucro: (sim.desiredMarginRate ?? 0) * 100,
    lucroLiquido: sim.netProfit ?? bestResult?.netProfit ?? 0,
    impostos: bestResult?.totalTax ?? 0,
    valorAVista: pix?.suggestedPrice ?? 0,
    jurosCartao: cardRes?.totalFees ?? cardRes?.totalInterest ?? 0,
    valorParcelaCartao: cardRes?.installmentValue ?? cardRes?.suggestedPrice ?? 0,
    jurosBoleto: boletoRes?.totalFees ?? boletoRes?.totalInterest ?? 0,
    valorParcelaBoleto: boletoRes?.installmentValue ?? boletoRes?.suggestedPrice ?? 0,
    diagnosis: sim.diagnosis || "—",
    bestMethod: sim.bestPaymentMethod || "—",
    createdAt: new Date(sim.createdAt).toLocaleDateString("pt-BR"),
    id: sim.id,
    // dados extras para PDF detalhado
    resultados: results,
    frete: product.freight ?? 0,
    custoOp: product.operationalCost ?? 0,
    embalagem: product.packaging ?? 0,
    regimeTrib: product.taxRegime ?? "",
  };
}

// ─── Gerador de PDF ───────────────────────────────────────────────────────────
function exportToPDF(rows: ReturnType<typeof extractSimRow>[], companyName = "Shoop PermuPay") {
  if (rows.length === 0) { toast.error("Nenhuma simulação para exportar"); return; }

  const now = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const totalLucro = rows.reduce((s, r) => s + r.lucroLiquido, 0);
  const margemMedia = rows.reduce((s, r) => s + r.margemLucro, 0) / rows.length;
  const precoMedio  = rows.reduce((s, r) => s + r.precoVenda, 0) / rows.length;

  const diagBadge = (d: string) => {
    const color = DIAGNOSIS_COLOR[d] ?? "#555";
    const bg    = DIAGNOSIS_BG[d]    ?? "#f5f5f5";
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.05em;background:${bg};color:${color};border:1px solid ${color}40">${d}</span>`;
  };

  // Linhas da tabela resumo
  const tableRows = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"}">
      <td style="padding:10px 12px;border-bottom:1px solid #eee">
        <div style="font-weight:600;font-size:12px;color:#111">${r.nome}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${r.produto}</div>
        <div style="font-size:9px;color:#bbb;margin-top:1px">${r.createdAt}</div>
      </td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;color:#555">${fmt(r.precoCusto)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;font-weight:700;color:#111">${fmt(r.precoVenda)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;color:#555">${fmtPct(r.margemLucro)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;font-weight:600;color:${r.lucroLiquido >= 0 ? "#16a34a" : "#dc2626"}">${fmt(r.lucroLiquido)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;color:#555">${fmt(r.impostos)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;color:#555">${r.valorAVista > 0 ? fmt(r.valorAVista) : "—"}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;color:#555">${r.valorParcelaCartao > 0 ? fmt(r.valorParcelaCartao) : "—"}</td>
      <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee">${diagBadge(r.diagnosis)}</td>
    </tr>
  `).join("");

  // Cards detalhados por simulação
  const detailCards = rows.map((r) => {
    const metodosHtml = r.resultados.map((res: any) => `
      <div style="flex:1;min-width:180px;border:1px solid #eee;border-radius:8px;padding:14px;background:#fafafa">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:#111">${METHOD_LABEL[res.method] ?? res.method}</span>
          ${diagBadge(res.diagnostic ?? "—")}
        </div>
        <div style="font-size:18px;font-weight:800;color:#111;margin-bottom:8px">${fmt(res.suggestedPrice)}</div>
        ${res.installments > 1 ? `<div style="font-size:10px;color:#888;margin-bottom:6px">${res.installments}× de ${fmt(res.installmentValue)}</div>` : ""}
        <table style="width:100%;font-size:10px;color:#666;border-collapse:collapse">
          <tr><td>Custo base</td><td style="text-align:right;color:#111">${fmt(res.baseCost)}</td></tr>
          <tr><td>Margem lucro</td><td style="text-align:right;color:#16a34a">+${fmt(res.marginValue)}</td></tr>
          <tr><td>Impostos</td><td style="text-align:right">${fmt(res.totalTax)}</td></tr>
          <tr><td>Taxas/Juros</td><td style="text-align:right">${fmt((res.totalFees ?? 0) + (res.totalInterest ?? 0))}</td></tr>
          <tr style="border-top:1px dashed #eee"><td style="padding-top:4px;font-weight:700;color:#111">Lucro líquido</td><td style="padding-top:4px;text-align:right;font-weight:700;color:${(res.netProfit ?? 0) >= 0 ? "#16a34a" : "#dc2626"}">${fmt(res.netProfit)}</td></tr>
          <tr><td>Margem real</td><td style="text-align:right;color:#111">${fmtPct((res.realMarginRate ?? 0) * 100)}</td></tr>
        </table>
      </div>
    `).join("");

    return `
      <div style="page-break-inside:avoid;margin-bottom:32px;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <!-- Header do card -->
        <div style="background:#111;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff">${r.nome}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px">${r.produto} · ${r.categoria} · ${r.createdAt}</div>
          </div>
          ${diagBadge(r.diagnosis)}
        </div>

        <!-- Dados do produto -->
        <div style="padding:16px 20px;background:#fafafa;border-bottom:1px solid #eee;display:flex;flex-wrap:wrap;gap:20px">
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Preço de Custo</div><div style="font-size:14px;font-weight:700;color:#111">${fmt(r.precoCusto)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Preço Recomendado</div><div style="font-size:14px;font-weight:700;color:#111">${fmt(r.precoVenda)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Margem Desejada</div><div style="font-size:14px;font-weight:700;color:#111">${fmtPct(r.margemLucro)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Lucro Líquido</div><div style="font-size:14px;font-weight:700;color:${r.lucroLiquido >= 0 ? "#16a34a" : "#dc2626"}">${fmt(r.lucroLiquido)}</div></div>
          ${r.frete > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Frete</div><div style="font-size:14px;font-weight:700;color:#111">${fmt(r.frete)}</div></div>` : ""}
          ${r.custoOp > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Custo Operac.</div><div style="font-size:14px;font-weight:700;color:#111">${fmt(r.custoOp)}</div></div>` : ""}
          ${r.regimeTrib ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">Regime Trib.</div><div style="font-size:14px;font-weight:700;color:#111">${r.regimeTrib}</div></div>` : ""}
        </div>

        <!-- Métodos de pagamento -->
        <div style="padding:16px 20px">
          <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Formas de Pagamento</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">${metodosHtml}</div>
        </div>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Simulações e Orçamentos — ${companyName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111; background: #fff; font-size: 12px; }
  @page { size: A4; margin: 18mm 15mm 18mm 15mm; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  table { border-collapse: collapse; }
</style>
</head>
<body>

<!-- CAPA -->
<div style="display:flex;flex-direction:column;min-height:100vh;padding:40px 0">
  <!-- Header da capa -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:40px;border-bottom:3px solid #111;margin-bottom:40px">
    <div>
      <div style="font-size:28px;font-weight:800;color:#111;letter-spacing:-0.03em">${companyName}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;letter-spacing:0.05em;text-transform:uppercase">Relatório de Precificação</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#888">Emitido em</div>
      <div style="font-size:14px;font-weight:600;color:#111">${now}</div>
    </div>
  </div>

  <!-- KPIs da capa -->
  <div style="display:flex;gap:20px;margin-bottom:48px;flex-wrap:wrap">
    ${[
      { label: "Simulações", value: String(rows.length), color: "#111" },
      { label: "Preço Médio", value: fmt(precoMedio), color: "#111" },
      { label: "Margem Média", value: fmtPct(margemMedia), color: "#111" },
      { label: "Lucro Total", value: fmt(totalLucro), color: totalLucro >= 0 ? "#16a34a" : "#dc2626" },
    ].map(k => `
      <div style="flex:1;min-width:140px;border:1px solid #e5e5e5;border-radius:10px;padding:20px 24px">
        <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px">${k.label}</div>
        <div style="font-size:22px;font-weight:800;color:${k.color};letter-spacing:-0.03em">${k.value}</div>
      </div>
    `).join("")}
  </div>

  <!-- Tabela resumo -->
  <div style="margin-bottom:40px">
    <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px">Resumo das Simulações</div>
    <div style="border:1px solid #e5e5e5;border-radius:10px;overflow:hidden">
      <table style="width:100%">
        <thead>
          <tr style="background:#111;color:#fff">
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.04em">Simulação / Produto</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Custo</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Venda</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Margem</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Lucro Líq.</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Impostos</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">PIX</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Parc. Cartão</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:0.04em">Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="background:#f5f5f5;border-top:2px solid #e5e5e5">
            <td style="padding:10px 12px;font-weight:700;font-size:11px;color:#111">TOTAIS / MÉDIAS</td>
            <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#555">${fmt(rows.reduce((s, r) => s + r.precoCusto, 0) / rows.length)} (méd.)</td>
            <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#111">${fmt(precoMedio)} (méd.)</td>
            <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#555">${fmtPct(margemMedia)} (méd.)</td>
            <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:${totalLucro >= 0 ? "#16a34a" : "#dc2626"}">${fmt(totalLucro)}</td>
            <td colspan="4" style="padding:10px 12px;text-align:right;font-size:10px;color:#aaa">${rows.length} simulação(ões) exportadas</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>

<!-- DETALHAMENTO POR SIMULAÇÃO -->
<div style="page-break-before:always">
  <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:20px;padding-top:10px">Detalhamento por Simulação</div>
  ${detailCards}
</div>

<!-- RODAPÉ -->
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;font-size:9px;color:#bbb">
  <span>${companyName} · Relatório gerado em ${now}</span>
  <span>Valores estimados — confirme com seu contador</span>
</div>

<!-- Botão de impressão (some no PDF) -->
<div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:10px">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:12px 24px;font-size:13px;font-weight:600;cursor:pointer;border-radius:8px;letter-spacing:0.04em">
    🖨️ Imprimir / Salvar PDF
  </button>
  <button onclick="window.close()" style="background:#f0f0f0;color:#555;border:none;padding:12px 20px;font-size:13px;cursor:pointer;border-radius:8px">
    Fechar
  </button>
</div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!win) { toast.error("Permita popups para gerar o PDF"); return; }
  win.document.write(html);
  win.document.close();
  toast.success("PDF gerado! Clique em 'Imprimir / Salvar PDF' na nova janela.");
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
              onClick={() => exportToPDF(rows)}
              disabled={rows.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF
            </Button>
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
