import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

export const AI_NOT_CONFIGURED_MESSAGE =
  "Sugestão por IA não está configurada neste ambiente. Peça para o administrador configurar BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY.";

const CATEGORIES = ["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"] as const;
export type ProductSuggestionCategory = (typeof CATEGORIES)[number];

export type ProductSuggestion = {
  name: string;
  category: ProductSuggestionCategory;
  categoryLabel?: string;
  shortDescription: string;
  description: string;
};

function parseContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

export function normalizeProductSuggestion(value: unknown): ProductSuggestion {
  if (!value || typeof value !== "object") throw new Error("A IA retornou uma sugestão inválida.");
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const shortDescription = typeof candidate.shortDescription === "string" ? candidate.shortDescription.trim().slice(0, 160) : "";
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const category = typeof candidate.category === "string" && CATEGORIES.includes(candidate.category as ProductSuggestionCategory)
    ? candidate.category as ProductSuggestionCategory
    : "OUTRO";
  const categoryLabel = typeof candidate.categoryLabel === "string" ? candidate.categoryLabel.trim() : "";
  if (!name || !shortDescription || !description) throw new Error("A IA não retornou todos os campos necessários para o cadastro.");
  return { name, category, categoryLabel, shortDescription, description };
}

export async function requestExternalProductSuggestion(input: { imageUrl?: string; name?: string }): Promise<ProductSuggestion> {
  const name = input.name?.trim() || "";
  const imageUrl = input.imageUrl?.trim() || "";
  if (!imageUrl && !name) throw new Error("Envie uma imagem ou um nome para a IA sugerir os dados.");
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error(AI_NOT_CONFIGURED_MESSAGE);

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [
    {
      type: "text",
      text: [
        "Você é um copywriter sênior de e-commerce brasileiro, especialista em conversão de vendas.",
        "Analise o produto (imagem e/ou nome) e monte um cadastro pronto para publicar, com textos",
        "persuasivos e verdadeiros — NUNCA invente especificação técnica que não seja visível na imagem",
        "ou óbvia pelo nome informado. Precisão em primeiro lugar; venda vem da forma como você apresenta",
        "o que é real, não de inventar características.",
        "",
        "Regras por campo:",
        "- name: nome comercial claro, específico e atrativo (evite genérico demais).",
        "- category / categoryLabel: melhor categoria entre CELULAR, ELETRONICO, PERFUME, OUTRO, com um",
        "  rótulo amigável para o cliente.",
        "- shortDescription (até 160 caracteres): uma chamada curta e persuasiva para a vitrine, destacando",
        "  o principal benefício ou diferencial do produto — o gatilho que faz o cliente clicar.",
        "- description: descrição completa em 2 a 4 parágrafos curtos, tom caloroso, direto e confiável,",
        "  em português do Brasil. Fale de BENEFÍCIOS para quem compra, não só características técnicas.",
        "  Pode usar gatilhos legítimos de conexão com o cliente (para quem é ideal, em que momento usar,",
        "  a sensação de ter o produto) e fechar com uma chamada leve para a ação. Nunca use urgência falsa,",
        "  promessa exagerada, superlativo vazio ('o melhor do mundo') ou dado técnico inventado.",
        "",
        "Categorias possíveis: CELULAR, ELETRONICO, PERFUME, OUTRO.",
      ].join("\n"),
    },
  ];
  if (name) content.push({ type: "text", text: `Nome informado pelo usuário: ${name}` });
  if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } });

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content }],
      // Nota: "maxLength" e "strict" foram removidos de propósito — nem todo
      // provedor OpenAI-compatível (ex.: Gemini) suporta esses extras do
      // schema, e o limite de 160 caracteres já é aplicado de forma segura
      // em normalizeProductSuggestion() abaixo, então nada se perde.
      outputSchema: {
        name: "product_suggestion",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: [...CATEGORIES] },
            categoryLabel: { type: "string" },
            shortDescription: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "category", "shortDescription", "description"],
        },
      },
    });
    const text = parseContent(result.choices?.[0]?.message?.content);
    if (!text) throw new Error("A IA não retornou conteúdo para a sugestão.");
    return normalizeProductSuggestion(JSON.parse(text));
  } catch (error) {
    if (error instanceof Error && (error.message === AI_NOT_CONFIGURED_MESSAGE || error.message.startsWith("A IA "))) throw error;
    // Log da causa real ANTES de trocar pela mensagem genérica do usuário —
    // sem isso, o erro de verdade (status HTTP, corpo da resposta do provedor,
    // JSON inválido etc.) se perde e nunca aparece nos logs do servidor.
    console.error("[AI] requestExternalProductSuggestion falhou:", {
      message: error instanceof Error ? error.message : String(error),
      forgeApiUrl: ENV.forgeApiUrl,
      llmModelName: ENV.llmModelName,
    });
    throw new Error("Não foi possível obter uma sugestão da IA agora. Você pode continuar o cadastro manualmente.");
  }
}
