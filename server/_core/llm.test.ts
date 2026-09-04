import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  forgeApiUrl: "",
  forgeApiKey: "",
  llmModelName: "gemini-3.5-flash",
}));

vi.mock("./env", () => ({ ENV: envMock }));

import { invokeLLM } from "./llm";

const okResponse = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () =>
      Promise.resolve({
        id: "1",
        created: 0,
        model: "gemini-3.5-flash",
        choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
      }),
  } as Response);

describe("invokeLLM — resolução de URL e payload OpenAI-compatível", () => {
  beforeEach(() => {
    envMock.forgeApiUrl = "";
    envMock.forgeApiKey = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa a URL completa como está quando ela já termina em /chat/completions (ex.: Gemini)", async () => {
    envMock.forgeApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(okResponse);

    await invokeLLM({ messages: [{ role: "user", content: "oi" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      expect.anything(),
    );
  });

  it("acrescenta /v1/chat/completions quando a URL configurada é só a raiz do provedor (compatibilidade retroativa)", async () => {
    envMock.forgeApiUrl = "https://forge.example.com";
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(okResponse);

    await invokeLLM({ messages: [{ role: "user", content: "oi" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://forge.example.com/v1/chat/completions",
      expect.anything(),
    );
  });

  it("NUNCA envia o campo 'thinking' (específico de um único proxy) — provedores OpenAI-compatíveis mais rígidos, como o Gemini, podem rejeitar a requisição inteira ao ver um campo desconhecido", async () => {
    envMock.forgeApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(okResponse);

    await invokeLLM({ messages: [{ role: "user", content: "oi" }] });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).not.toHaveProperty("thinking");
    expect(body.max_tokens).toBe(4096);
  });

  it("respeita um max_tokens explícito quando informado pelo chamador", async () => {
    envMock.forgeApiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(okResponse);

    await invokeLLM({ messages: [{ role: "user", content: "oi" }], maxTokens: 512 });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBe(512);
  });

  it("propaga status e corpo da resposta de erro do provedor na mensagem de exceção", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve('{"error":"unknown field"}'),
    } as Response);

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "oi" }] }),
    ).rejects.toThrow(/400.*Bad Request.*unknown field/s);
  });
});
