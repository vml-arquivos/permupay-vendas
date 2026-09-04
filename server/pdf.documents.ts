/**
 * server/pdf.documents.ts — Geração de PDFs (nota promissória e comprovante)
 *
 * Usa pdf-lib (puro JS, sem dependência nativa/Chromium) — seguro para rodar
 * em qualquer container Docker sem precisar instalar navegador headless.
 *
 * Fontes padrão (Helvetica/Helvetica-Bold, codificação WinAnsi) cobrem os
 * acentos do português (á é í ó ú â ê ô ã õ ç), então não é necessário
 * embutir fontes externas.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 retrato, em pontos (72dpi)
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

function fmtCurrency(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(value: Date): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Extenso simplificado de valor monetário em português (suficiente para o texto legal da nota). */
function currencyToWords(value: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dez19 = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function upTo999(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const r = n % 100;
    const parts: string[] = [];
    if (c > 0) parts.push(centenas[c]!);
    if (r > 0) {
      if (r < 10) parts.push(unidades[r]!);
      else if (r < 20) parts.push(dez19[r - 10]!);
      else {
        const d = Math.floor(r / 10);
        const u = r % 10;
        parts.push(u > 0 ? `${dezenas[d]} e ${unidades[u]}` : dezenas[d]!);
      }
    }
    return parts.join(" e ");
  }

  function intToWords(n: number): string {
    if (n === 0) return "zero";
    const milhoes = Math.floor(n / 1_000_000);
    const milhares = Math.floor((n % 1_000_000) / 1000);
    const resto = n % 1000;
    const parts: string[] = [];
    if (milhoes > 0) parts.push(`${milhoes === 1 ? "um milhão" : `${upTo999(milhoes)} milhões`}`);
    if (milhares > 0) parts.push(`${milhares === 1 ? "mil" : `${upTo999(milhares)} mil`}`);
    if (resto > 0) parts.push(upTo999(resto));
    return parts.join(" e ");
  }

  const cents = Math.round(value * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const reaisWords = `${intToWords(reais)} ${reais === 1 ? "real" : "reais"}`;
  if (centavos === 0) return reaisWords;
  const centavosWords = `${intToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return `${reaisWords} e ${centavosWords}`;
}

type PromissoryNoteDocData = {
  installmentNumber: number;
  installmentsTotal: number;
  amount: number;
  totalObligationAmount: number;
  dueDate: Date;
  issueDate: Date;
  issuePlace: string;
  paymentPlace: string;
  beneficiaryName: string;
  beneficiaryDocument?: string | null;
  beneficiaryAddress?: string | null;
  issuerName: string;
  issuerDocument?: string | null;
  issuerAddress?: string | null;
  productDescription: string;
  orderId: number;
};

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Gera o PDF de uma nota promissória (uma parcela). O texto legal foi
 * otimizado a partir do modelo de referência, mantendo os mesmos campos e
 * incluindo uma cláusula explícita de reconhecimento de dívida — para que a
 * assinatura do cliente sirva como reconhecimento de que a compra e o
 * parcelamento foram realmente contratados por ele.
 */
export async function renderPromissoryNotePdf(
  data: PromissoryNoteDocData
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  // Moldura externa (documento formal, como o modelo em papel)
  page.drawRectangle({
    x: MARGIN - 10,
    y: MARGIN - 10,
    width: contentWidth + 20,
    height: PAGE_HEIGHT - MARGIN * 2 + 20,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 1.2,
  });

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; x?: number; color?: [number, number, number] } = {}
  ) => {
    const size = opts.size ?? 10;
    page.drawText(text, {
      x: opts.x ?? MARGIN,
      y,
      size,
      font: opts.bold ? bold : font,
      color: rgb(...(opts.color ?? [0.05, 0.05, 0.05])),
    });
  };

  // Cabeçalho
  page.drawText("NOTA PROMISSÓRIA", {
    x: MARGIN,
    y: y - 4,
    size: 20,
    font: bold,
    color: rgb(0.05, 0.05, 0.05),
  });
  const noLabel = `Nº ${String(data.installmentNumber).padStart(2, "0")}/${String(data.installmentsTotal).padStart(2, "0")}`;
  const noWidth = bold.widthOfTextAtSize(noLabel, 14);
  page.drawText(noLabel, {
    x: PAGE_WIDTH - MARGIN - noWidth,
    y: y - 2,
    size: 14,
    font: bold,
  });
  y -= 30;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 20;

  drawText(`Pedido de referência: #${data.orderId}`, { size: 9, color: [0.35, 0.35, 0.35] });
  y -= 16;
  drawText(`VENCIMENTO: ${fmtDate(data.dueDate)}`, { bold: true, size: 12 });
  y -= 26;

  // Caixa de valor
  const boxHeight = 40;
  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight + 10,
    width: contentWidth,
    height: boxHeight,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 1,
  });
  page.drawText("VALOR", {
    x: MARGIN + 10,
    y: y - 6,
    size: 9,
    font: bold,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(fmtCurrency(data.amount), {
    x: MARGIN + 10,
    y: y - 24,
    size: 18,
    font: bold,
  });
  y -= boxHeight + 20;

  drawText("BENEFICIÁRIO / CREDOR:", { bold: true, size: 9 });
  y -= 14;
  drawText(data.beneficiaryName, { size: 11 });
  y -= 16;
  drawText(`CPF/CNPJ: ${data.beneficiaryDocument || "—"}`, { size: 9, color: [0.35, 0.35, 0.35] });
  if (data.beneficiaryAddress) {
    y -= 12;
    drawText(data.beneficiaryAddress, { size: 8.5, color: [0.4, 0.4, 0.4] });
  }
  y -= 26;

  const valueWords = currencyToWords(data.amount);
  const totalWords = currencyToWords(data.totalObligationAmount);

  const paragraph1 = `Por esta única via de NOTA PROMISSÓRIA, o(a) emitente abaixo identificado(a) pagará ao beneficiário acima identificado, ou à sua ordem, na data de vencimento indicada, a quantia de ${fmtCurrency(data.amount)} (${valueWords}), em moeda corrente nacional.`;
  for (const line of wrapText(paragraph1, font, 10, contentWidth)) {
    drawText(line, { size: 10 });
    y -= 14;
  }
  y -= 4;

  const paragraph2 = `Esta Nota Promissória corresponde à parcela nº ${data.installmentNumber}/${data.installmentsTotal}, integrante da obrigação total de ${fmtCurrency(data.totalObligationAmount)} (${totalWords}), referente à compra de: ${data.productDescription}, parcelada em ${data.installmentsTotal} pagamento(s).`;
  for (const line of wrapText(paragraph2, font, 10, contentWidth)) {
    drawText(line, { size: 10 });
    y -= 14;
  }
  y -= 4;

  const paragraph3 = `O(a) emitente reconhece, para todos os efeitos de direito, que esta Nota Promissória representa dívida líquida, certa e exigível, decorrente da compra acima descrita e das condições de pagamento livremente pactuadas entre as partes, nos termos da legislação cambial aplicável (Decreto nº 57.663/66 — Lei Uniforme de Genebra) e do Código Civil Brasileiro, constituindo título de crédito autônomo e exequível.`;
  for (const line of wrapText(paragraph3, font, 9, contentWidth)) {
    drawText(line, { size: 9, color: [0.25, 0.25, 0.25] });
    y -= 12;
  }
  y -= 14;

  drawText(`LOCAL DE PAGAMENTO: ${data.paymentPlace}`, { size: 9.5 });
  y -= 15;
  drawText(
    `LOCAL E DATA DA EMISSÃO: ${data.issuePlace}, ${fmtDate(data.issueDate)}`,
    { size: 9.5 }
  );
  y -= 30;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 18;

  drawText("EMITENTE / DEVEDOR", { bold: true, size: 9, color: [0.35, 0.35, 0.35] });
  y -= 16;
  drawText(data.issuerName, { bold: true, size: 12 });
  y -= 16;
  drawText(`CPF: ${data.issuerDocument || "—"}`, { size: 10 });
  y -= 14;
  if (data.issuerAddress) {
    for (const line of wrapText(`Endereço: ${data.issuerAddress}`, font, 9.5, contentWidth)) {
      drawText(line, { size: 9.5 });
      y -= 13;
    }
  }
  y -= 20;

  drawText("Assinatura do emitente: ____________________________________________", {
    size: 10,
  });
  y -= 36;

  const obsHeight = 34;
  page.drawRectangle({
    x: MARGIN,
    y: y - obsHeight + 10,
    width: contentWidth,
    height: obsHeight,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 0.8,
  });
  page.drawText("OBSERVAÇÃO", {
    x: MARGIN + 10,
    y: y - 4,
    size: 8,
    font: bold,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText("Título emitido sem avalista, fiador ou coobrigado.", {
    x: MARGIN + 10,
    y: y - 18,
    size: 9,
    font,
  });
  y -= obsHeight + 24;

  const footer = `Parcela ${data.installmentNumber}/${data.installmentsTotal} — Valor ${fmtCurrency(data.amount)} — Vencimento ${fmtDate(data.dueDate)}`;
  const footerWidth = bold.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: (PAGE_WIDTH - footerWidth) / 2,
    y: MARGIN + 4,
    size: 9,
    font: bold,
    color: rgb(0.3, 0.3, 0.3),
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

type ReceiptDocData = {
  orderId: number;
  customerName: string;
  customerContact: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethodLabel: string;
  confirmedAt?: Date | null;
  adminNotes?: string | null;
  installments?: { number: number; amount: number; dueDate: Date }[] | null;
  beneficiaryName: string;
};

/** Gera o PDF do comprovante/recibo de compra — para download e envio junto com a mensagem do WhatsApp. */
export async function renderReceiptPdf(data: ReceiptDocData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(data.beneficiaryName, { x: MARGIN, y, size: 16, font: bold });
  y -= 20;
  page.drawText("Comprovante de compra / pagamento confirmado", {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 24;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 24;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: rgb(0.35, 0.35, 0.35) });
    y -= 13;
    page.drawText(value, { x: MARGIN, y, size: 11, font });
    y -= 20;
  };

  row("Pedido", `#${data.orderId}`);
  row("Cliente", data.customerName);
  row("Contato", data.customerContact);
  row("Produto", `${data.productName} (${data.quantity} un.)`);
  row("Forma de pagamento", data.paymentMethodLabel);
  row("Valor unitário", fmtCurrency(data.unitPrice));
  row("Valor total", fmtCurrency(data.totalPrice));
  if (data.confirmedAt) row("Confirmado em", fmtDate(data.confirmedAt));

  if (data.installments?.length) {
    y -= 6;
    page.drawText(`Parcelamento (${data.installments.length}x)`, {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
    });
    y -= 16;
    for (const inst of data.installments) {
      page.drawText(
        `Parcela ${inst.number}/${data.installments.length} — ${fmtCurrency(inst.amount)} — vencimento ${fmtDate(inst.dueDate)}`,
        { x: MARGIN, y, size: 9.5, font }
      );
      y -= 14;
    }
    y -= 6;
  }

  if (data.adminNotes) {
    for (const line of wrapText(`Observação: ${data.adminNotes}`, font, 9.5, contentWidth)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 13;
    }
  }

  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 16;
  page.drawText(
    "Este comprovante confirma o recebimento do pagamento indicado acima.",
    { x: MARGIN, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) }
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
