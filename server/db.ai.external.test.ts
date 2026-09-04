import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  forgeApiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  forgeApiKey: "test-key",
  llmModelName: "gemini-3.5-flash",
}));

vi.mock("./_core/env", () => ({ ENV: envMock }));

import { requestExternalProductSuggestion } from "./db.ai.external";

describe("requestExternalProductSuggestion — schema OpenAI-compatível e diagnóstico", () => {
  beforeEach(() => {
    envMock.forgeApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    envMock.forgeApiKey = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não envia 'strict' nem 'maxLength' no json_schema — nem todo provedor OpenAI-compatível os suporta", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          id: "1",
          created: 0,
          model: "gemini-3.5-flash",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  name: "Produto X",
                  category: "OUTRO",
                  categoryLabel: "Outro",
                  shortDescription: "Curta",
                  description: "Completa",
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
    } as Response);

    await requestExternalProductSuggestion({ name: "Produto X" });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.response_format.json_schema).not.toHaveProperty("strict");
    expect(body.response_format.json_schema.schema.properties.shortDescription).not.toHaveProperty("maxLength");
  });

  it("registra a causa real do erro no console antes de trocar pela mensagem genérica ao usuário", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve('{"error":"unrecognized field: thinking"}'),
    } as Response);

    await expect(requestExternalProductSuggestion({ name: "Produto X" })).rejects.toThrow(
      "Não foi possível obter uma sugestão da IA agora. Você pode continuar o cadastro manualmente.",
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "[AI] requestExternalProductSuggestion falhou:",
      expect.objectContaining({
        message: expect.stringContaining("400"),
      }),
    );
  });
});
