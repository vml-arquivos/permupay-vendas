/**
 * server/_core/documentRoutes.ts
 *
 * Link público de documentos do pedido — "magic link" (token opaco de 64
 * caracteres, não sequencial, não adivinhável) que dá acesso, sem exigir
 * login, ao comprovante de pagamento e às notas promissórias de UM pedido
 * específico. É o link incluído automaticamente na mensagem de WhatsApp/
 * e-mail enviada ao cliente (ver client/src/lib/receipt.ts), para que ele
 * baixe seus próprios documentos a qualquer momento.
 *
 * Não usa tRPC de propósito: precisa gerar HTML/PDF diretamente para o
 * navegador do cliente (que pode nem ter JavaScript habilitado ao abrir o
 * link a partir do WhatsApp), então são rotas Express simples, registradas
 * em server/_core/index.ts junto com as demais rotas públicas (upload,
 * storage proxy).
 */
import type { Express, Request, Response } from "express";
import * as dbOrders from "../db.orders";
import * as dbPromissoryNotes from "../db.promissoryNotes";
import * as dbPayment from "../db.payment-settings";
import { PUBLIC_BASE_URL } from "../storage.upload";

const PAYMENT_LABEL: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
};

const STATUS_LABEL: Record<string, string> = {
  GERADA: "Gerada — aguardando envio",
  ENVIADA: "Enviada ao cliente",
  ASSINADA_DEVOLVIDA: "Assinada e devolvida",
  CANCELADA: "Cancelada",
};

function fmt(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadOrderForToken(token: string) {
  const order = await dbOrders.getOrderByAccessToken(token);
  if (!order) return null;
  const notes = await dbPromissoryNotes.listNotesByOrder(order.id);
  return { order, notes };
}

function renderNotFoundPage(res: Response) {
  res
    .status(404)
    .set("Content-Type", "text/html; charset=utf-8")
    .send(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documentos não encontrados</title>
      <style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
      .box{max-width:420px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px}
      h1{font-size:18px;color:#0f172a}p{color:#64748b;font-size:14px}</style></head>
      <body><div class="box"><h1>Link não encontrado</h1><p>Este link de documentos é inválido ou expirou. Fale com quem te enviou este link para receber um novo.</p></div></body></html>`
    );
}

function renderDocumentsPage(
  order: Awaited<ReturnType<typeof dbOrders.getOrderByAccessToken>> & {},
  notes: Awaited<ReturnType<typeof dbPromissoryNotes.listNotesByOrder>>,
  token: string
): string {
  if (!order) return "";
  const noteRows = notes
    .map(
      n => `
      <div class="note">
        <div>
          <strong>Parcela ${n.installmentNumber}/${n.installmentsTotal}</strong>
          <span class="muted"> — ${fmt(n.amount)} — vencimento ${fmtDate(n.dueDate)}</span>
          <div class="status">${escapeHtml(STATUS_LABEL[n.status] ?? n.status)}</div>
        </div>
        <a class="btn btn-outline" href="${escapeHtml(n.documentUrl ?? "#")}" target="_blank" rel="noopener noreferrer">Baixar PDF</a>
      </div>`
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Seus documentos — Pedido #${order.id}</title>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a}
    .wrap{max-width:640px;margin:0 auto}
    header{background:linear-gradient(135deg,#020617,#1e293b);color:#fff;border-radius:20px;padding:28px}
    header p.eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#fcd34d;margin:0}
    header h1{margin:8px 0 0;font-size:22px}
    header p.sub{margin:8px 0 0;color:#cbd5e1;font-size:13px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-top:16px}
    .card h2{margin:0 0 12px;font-size:15px}
    .row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:14px;border-bottom:1px solid #f1f5f9}
    .row:last-child{border-bottom:none}
    .row span:first-child{color:#64748b}
    .row span:last-child{font-weight:600;text-align:right}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid transparent}
    .btn-primary{background:#0f172a;color:#fff}
    .btn-outline{background:#fff;border-color:#cbd5e1;color:#0f172a;white-space:nowrap}
    .note{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:12px;margin-top:10px}
    .note .status{font-size:11px;color:#92400e;margin-top:2px}
    .muted{color:#64748b;font-weight:400}
    footer{text-align:center;color:#94a3b8;font-size:12px;margin:24px 0}
  </style></head>
  <body>
    <div class="wrap">
      <header>
        <p class="eyebrow">Seus documentos</p>
        <h1>Pedido #${order.id}</h1>
        <p class="sub">${escapeHtml(order.productName)} · ${escapeHtml(order.buyerName)}</p>
      </header>

      <div class="card">
        <h2>Comprovante de pagamento</h2>
        <div class="row"><span>Valor total</span><span>${fmt(order.totalPrice)}</span></div>
        <div class="row"><span>Forma de pagamento</span><span>${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span></div>
        <div style="margin-top:14px">
          <a class="btn btn-primary" href="/documentos/${token}/comprovante.pdf" target="_blank" rel="noopener noreferrer">Baixar comprovante (PDF)</a>
        </div>
      </div>

      ${
        notes.length
          ? `<div class="card">
        <h2>Notas promissórias (${notes.length}x)</h2>
        <p class="muted" style="font-size:13px;margin-top:-6px">Assine e devolva cada nota para liberarmos o envio dos boletos de pagamento.</p>
        ${noteRows}
      </div>`
          : ""
      }

      <footer>Shoop PermuPay — link pessoal de documentos deste pedido.</footer>
    </div>
  </body></html>`;
}

export function registerDocumentRoutes(app: Express): void {
  app.get("/documentos/:token", async (req: Request, res: Response) => {
    try {
      const loaded = await loadOrderForToken(req.params.token);
      if (!loaded) return renderNotFoundPage(res);
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .send(renderDocumentsPage(loaded.order, loaded.notes, req.params.token));
    } catch (error) {
      console.error("[documentRoutes] Erro ao montar página de documentos:", error);
      res.status(500).send("Não foi possível carregar os documentos agora.");
    }
  });

  app.get(
    "/documentos/:token/comprovante.pdf",
    async (req: Request, res: Response) => {
      try {
        const loaded = await loadOrderForToken(req.params.token);
        if (!loaded) return res.status(404).send("Documento não encontrado.");
        const { order, notes } = loaded;
        const settings = await dbPayment.getPaymentSettings();
        const { renderReceiptPdf } = await import("../pdf.documents");
        const pdfBuffer = await renderReceiptPdf({
          orderId: order.id,
          customerName: order.buyerName,
          customerContact: order.buyerContact,
          productName: order.productName,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          totalPrice: order.totalPrice,
          paymentMethodLabel:
            PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod,
          confirmedAt: order.confirmedAt,
          adminNotes: order.adminNotes,
          installments: notes.length
            ? notes.map(n => ({
                number: n.installmentNumber,
                amount: n.amount,
                dueDate: n.dueDate,
              }))
            : null,
          beneficiaryName: (settings as any).beneficiaryName || "Shoop PermuPay",
        });
        res.set("Content-Type", "application/pdf");
        res.set(
          "Content-Disposition",
          `inline; filename="comprovante_pedido_${order.id}.pdf"`
        );
        res.send(pdfBuffer);
      } catch (error) {
        console.error("[documentRoutes] Erro ao gerar comprovante:", error);
        res.status(500).send("Não foi possível gerar o comprovante agora.");
      }
    }
  );
}

export function buildDocumentsUrl(token: string): string {
  return `${PUBLIC_BASE_URL}/documentos/${token}`;
}
