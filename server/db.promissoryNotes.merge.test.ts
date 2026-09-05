import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergeNotesPdfs } from "./db.promissoryNotes";

/**
 * Cobre "Imprimir todas as promissórias de uma vez" (ficha do cliente): a
 * função busca os PDFs reais já emitidos (um por nota) pela própria URL
 * pública e junta as páginas num único PDF com pdf-lib, em vez de recriar o
 * conteúdo da nota do zero. Aqui simulamos as respostas HTTP (via
 * `global.fetch`) para não depender de rede/armazenamento reais.
 */

async function makeOnePagePdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return doc.save();
}

function note(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    orderId: 10,
    documentUrl: "https://example.com/nota_10_1.pdf",
    status: "GERADA",
    ...overrides,
  } as any;
}

describe("mergeNotesPdfs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lança erro quando nenhuma nota tem documentUrl", async () => {
    await expect(
      mergeNotesPdfs([note({ documentUrl: null }), note({ id: 2, documentUrl: undefined })])
    ).rejects.toThrow(/nenhuma nota promissória com pdf/i);
  });

  it("junta os PDFs de várias notas num único documento, uma página por nota", async () => {
    const pdfBytes = await makeOnePagePdfBytes();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ),
    });
    vi.stubGlobal("fetch", fetchMock);

    const notes = [
      note({ id: 1, orderId: 10 }),
      note({ id: 2, orderId: 10, documentUrl: "https://example.com/nota_10_2.pdf" }),
      note({ id: 3, orderId: 10, documentUrl: "https://example.com/nota_10_3.pdf" }),
    ];

    const merged = await mergeNotesPdfs(notes);
    const mergedDoc = await PDFDocument.load(merged);
    expect(mergedDoc.getPageCount()).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignora silenciosamente uma nota cujo PDF falha ao baixar, mas mescla as demais", async () => {
    const pdfBytes = await makeOnePagePdfBytes();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("falha")) return { ok: false, status: 404 };
      return {
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength
        ),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    // Evita poluir a saída do teste com o console.error esperado desta falha.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const notes = [
      note({ id: 1, orderId: 10, documentUrl: "https://example.com/ok_1.pdf" }),
      note({ id: 2, orderId: 10, documentUrl: "https://example.com/falha.pdf" }),
      note({ id: 3, orderId: 10, documentUrl: "https://example.com/ok_3.pdf" }),
    ];

    const merged = await mergeNotesPdfs(notes);
    const mergedDoc = await PDFDocument.load(merged);
    expect(mergedDoc.getPageCount()).toBe(2);
  });

  it("nunca inclui uma nota CANCELADA — o filtro é responsabilidade do chamador (router), mas a função em si só olha documentUrl", async () => {
    // Documenta o contrato: mergeNotesPdfs não filtra por status sozinha —
    // quem decide o que é "imprimível" é o router (mergedPdfByCustomer),
    // que já exclui CANCELADA antes de chamar esta função.
    const pdfBytes = await makeOnePagePdfBytes();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength
        ),
      })
    );
    const merged = await mergeNotesPdfs([note({ status: "CANCELADA" })]);
    const mergedDoc = await PDFDocument.load(merged);
    expect(mergedDoc.getPageCount()).toBe(1);
  });
});
