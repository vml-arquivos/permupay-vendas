/**
 * server/db.promissoryNotes.ts — Geração e gestão de notas promissórias
 *
 * Uma nota por parcela de uma venda em BOLETO, gerada automaticamente assim
 * que o pedido é criado (ver `generatePromissoryNotesForOrder`, chamada a
 * partir de server/db.orders.ts). Nunca bloqueia a venda: qualquer falha na
 * geração é registrada em log e engolida pelo chamador.
 *
 * Ciclo de vida do documento (controlado manualmente pelo admin em /clientes
 * ou na tela de pedidos): GERADA -> ENVIADA -> ASSINADA_DEVOLVIDA. Os boletos
 * bancários de pagamento só devem ser enviados ao cliente depois que TODAS as
 * notas do pedido estiverem ASSINADA_DEVOLVIDA — ver `allNotesSignedForOrder`.
 */

import { eq, and, desc } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { getDb } from "./db";
import {
  promissoryNotes,
  PROMISSORY_NOTE_STATUSES,
  type PromissoryNote,
  type PromissoryNoteStatus,
} from "../drizzle/schema.promissoryNotes";
import { getPaymentSettings } from "./db.payment-settings";
import {
  computeFirstDueDate,
  computeInstallmentSchedule,
} from "../shared/promissoryNoteEngine";
import { renderPromissoryNotePdf } from "./pdf.documents";
import { uploadDocumentBuffer } from "./storage.upload";

export type GenerateNotesInput = {
  orderId: number;
  customerId: number | null;
  productDescription: string;
  totalPrice: number;
  installments: number;
  purchaseDate: Date;
  issuer: {
    name: string;
    document?: string | null;
    address?: string | null;
  };
};

export async function listNotesByOrder(
  orderId: number
): Promise<PromissoryNote[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(promissoryNotes)
    .where(eq(promissoryNotes.orderId, orderId))
    .orderBy(promissoryNotes.installmentNumber);
}

export async function listNotesByCustomer(
  customerId: number
): Promise<PromissoryNote[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(promissoryNotes)
    .where(eq(promissoryNotes.customerId, customerId))
    .orderBy(desc(promissoryNotes.createdAt));
}

/**
 * Todas as notas promissórias do sistema, mais recentes primeiro — usada
 * pela página central "Promissórias" (/promissorias), para o admin ver,
 * baixar/imprimir e gerenciar todas as notas num único lugar, sem precisar
 * abrir o relatório de cada cliente individualmente.
 */
export async function listAllNotes(
  filters: { status?: PromissoryNoteStatus; search?: string } = {}
): Promise<PromissoryNote[]> {
  const db = await getDb();
  if (!db) return [];

  let rows = await db
    .select()
    .from(promissoryNotes)
    .where(
      filters.status ? eq(promissoryNotes.status, filters.status) : undefined
    )
    .orderBy(desc(promissoryNotes.createdAt));

  const term = filters.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      n =>
        n.issuerName.toLowerCase().includes(term) ||
        String(n.orderId).includes(term) ||
        (n.issuerDocument ?? "").toLowerCase().includes(term) ||
        n.productDescription.toLowerCase().includes(term)
    );
  }

  return rows;
}

export async function allNotesSignedForOrder(orderId: number): Promise<boolean> {
  const notes = await listNotesByOrder(orderId);
  if (!notes.length) return false;
  return notes.every(
    n => n.status === "ASSINADA_DEVOLVIDA" || n.status === "CANCELADA"
  );
}

/**
 * Gera automaticamente uma nota promissória por parcela para um pedido em
 * BOLETO. Idempotente: se o pedido já tem notas geradas, não gera de novo.
 * Nunca lança — falhas são responsabilidade do chamador tratar via try/catch
 * (o padrão já usado para não bloquear a venda por causa de um efeito
 * colateral).
 */
export async function generatePromissoryNotesForOrder(
  input: GenerateNotesInput
): Promise<PromissoryNote[]> {
  const db = await getDb();
  if (!db) return [];

  const existing = await listNotesByOrder(input.orderId);
  if (existing.length > 0) return existing;

  const installments = Math.max(1, Math.round(Number(input.installments) || 1));
  const totalPrice = Number(input.totalPrice);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return [];

  const settings = await getPaymentSettings();
  const firstDueDate = computeFirstDueDate(
    input.purchaseDate,
    Number((settings as any).boletoFirstDueDays ?? 30)
  );
  const schedule = computeInstallmentSchedule(
    totalPrice,
    installments,
    firstDueDate
  );

  const beneficiaryName = (settings as any).beneficiaryName || "Shoop PermuPay";
  const beneficiaryDocument = (settings as any).beneficiaryDocument ?? null;
  const beneficiaryAddress = (settings as any).beneficiaryAddress ?? null;
  const paymentPlace = (settings as any).paymentPlace || "Brasília/DF";
  const issuePlace = paymentPlace;
  const issueDate = new Date();

  const created: PromissoryNote[] = [];
  for (const item of schedule) {
    try {
      const pdfBuffer = await renderPromissoryNotePdf({
        installmentNumber: item.installmentNumber,
        installmentsTotal: item.installmentsTotal,
        amount: item.amount,
        totalObligationAmount: totalPrice,
        dueDate: item.dueDate,
        issueDate,
        issuePlace,
        paymentPlace,
        beneficiaryName,
        beneficiaryDocument,
        beneficiaryAddress,
        issuerName: input.issuer.name,
        issuerDocument: input.issuer.document ?? null,
        issuerAddress: input.issuer.address ?? null,
        productDescription: input.productDescription,
        orderId: input.orderId,
      });

      const documentUrl = await uploadDocumentBuffer(
        "promissorias",
        pdfBuffer,
        `nota_${input.orderId}_${item.installmentNumber}.pdf`,
        "application/pdf"
      );

      const [row] = await db
        .insert(promissoryNotes)
        .values({
          orderId: input.orderId,
          customerId: input.customerId,
          installmentNumber: item.installmentNumber,
          installmentsTotal: item.installmentsTotal,
          amount: item.amount,
          totalObligationAmount: totalPrice,
          dueDate: item.dueDate,
          issueDate,
          issuePlace,
          paymentPlace,
          beneficiaryName,
          beneficiaryDocument,
          beneficiaryAddress,
          issuerName: input.issuer.name,
          issuerDocument: input.issuer.document ?? null,
          issuerAddress: input.issuer.address ?? null,
          productDescription: input.productDescription,
          status: "GERADA",
          documentUrl,
        })
        .onConflictDoNothing({
          target: [promissoryNotes.orderId, promissoryNotes.installmentNumber],
        })
        .returning();

      if (row) created.push(row);
    } catch (error) {
      console.error(
        `[promissoryNotes] Falha ao gerar parcela ${item.installmentNumber}/${item.installmentsTotal} do pedido #${input.orderId}:`,
        error
      );
    }
  }

  return created;
}

export async function updateNoteStatus(params: {
  noteId: number;
  status: PromissoryNoteStatus;
  notes?: string;
}): Promise<PromissoryNote> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!PROMISSORY_NOTE_STATUSES.includes(params.status)) {
    throw new Error("Status de nota promissória inválido");
  }

  const update: Partial<typeof promissoryNotes.$inferInsert> = {
    status: params.status,
    updatedAt: new Date(),
  };
  if (params.status === "ENVIADA") update.sentAt = new Date();
  if (params.status === "ASSINADA_DEVOLVIDA") update.signedReturnedAt = new Date();
  if (params.status === "CANCELADA") update.cancelledAt = new Date();
  if (params.notes !== undefined) update.notes = params.notes.trim() || null;

  const [updated] = await db
    .update(promissoryNotes)
    .set(update)
    .where(eq(promissoryNotes.id, params.noteId))
    .returning();
  if (!updated) throw new Error("Nota promissória não encontrada");
  return updated;
}

export async function markAllNotesSentForOrder(orderId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .update(promissoryNotes)
    .set({ status: "ENVIADA", sentAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(promissoryNotes.orderId, orderId), eq(promissoryNotes.status, "GERADA"))
    )
    .returning();
  return rows.length;
}

/**
 * Junta os PDFs reais (já gerados e armazenados, um por nota — ver
 * `generatePromissoryNotesForOrder`) de uma lista de notas promissórias em
 * um único PDF, na ordem informada. Usado por "Imprimir todas de uma vez"
 * na ficha do cliente: em vez de reconstruir o conteúdo da nota do zero
 * (arriscando divergir do PDF oficial já emitido), busca cada PDF pela sua
 * própria URL pública e mescla as páginas de verdade com pdf-lib.
 *
 * Lança erro se nenhuma nota tiver `documentUrl` (nada para imprimir) — o
 * chamador decide como comunicar isso ao usuário.
 */
export async function mergeNotesPdfs(notes: PromissoryNote[]): Promise<Buffer> {
  const withDocs = notes.filter((n) => !!n.documentUrl);
  if (withDocs.length === 0) {
    throw new Error("Nenhuma nota promissória com PDF disponível para imprimir.");
  }

  const merged = await PDFDocument.create();
  for (const note of withDocs) {
    try {
      const response = await fetch(note.documentUrl as string);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const sourceDoc = await PDFDocument.load(arrayBuffer);
      const pages = await merged.copyPages(sourceDoc, sourceDoc.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch (error) {
      console.error(
        `[promissoryNotes] Falha ao juntar o PDF da nota #${note.id} (pedido #${note.orderId}):`,
        error
      );
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error("Não foi possível carregar nenhum dos PDFs das notas promissórias.");
  }

  const bytes = await merged.save();
  return Buffer.from(bytes);
}
