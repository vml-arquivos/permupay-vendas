import { describe, expect, it } from "vitest";
import { assertPaymentMethodEnabled, buildOrderFilterConditions } from "./db.orders";

/**
 * Cobre a validação server-side de "pagamento configurável por produto":
 * mesmo que a UI esconda uma opção, o backend precisa recusar a venda se o
 * método não estiver habilitado para aquele produto específico — tanto na
 * vitrine pública (createOrder/createSellerOrder, produto vindo do Drizzle
 * em camelCase) quanto na venda interna (createDirectSale, produto vindo de
 * SQL cru em snake_case via `SELECT * ... FOR UPDATE`).
 */
describe("assertPaymentMethodEnabled", () => {
  it("permite quando o método está habilitado (camelCase, formato Drizzle)", () => {
    const product = { pixEnabled: true, cardEnabled: true, boletoEnabled: true, cashEnabled: true };
    expect(() => assertPaymentMethodEnabled(product, "PIX")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(product, "CARTAO")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(product, "BOLETO")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(product, "DINHEIRO")).not.toThrow();
  });

  it("bloqueia quando o método está desabilitado (camelCase, formato Drizzle)", () => {
    const product = { pixEnabled: false, cardEnabled: true, boletoEnabled: true, cashEnabled: true };
    expect(() => assertPaymentMethodEnabled(product, "PIX")).toThrow(/Pix/);
    expect(() => assertPaymentMethodEnabled(product, "CARTAO")).not.toThrow();
  });

  it("bloqueia quando o método está desabilitado (snake_case, SQL cru — createDirectSale)", () => {
    const product = { pix_enabled: true, card_enabled: false, boleto_enabled: true, cash_enabled: true };
    expect(() => assertPaymentMethodEnabled(product, "CARTAO")).toThrow(/Cartão/);
    expect(() => assertPaymentMethodEnabled(product, "PIX")).not.toThrow();
  });

  it("bloqueia BOLETO e DINHEIRO desabilitados com a mensagem correta por método", () => {
    const productSemBoleto = { boleto_enabled: false };
    expect(() => assertPaymentMethodEnabled(productSemBoleto, "BOLETO")).toThrow(
      "Este produto não aceita pagamento via Boleto. Escolha outra forma de pagamento."
    );

    const productSemDinheiro = { cashEnabled: false };
    expect(() => assertPaymentMethodEnabled(productSemDinheiro, "DINHEIRO")).toThrow(
      "Este produto não aceita pagamento via Dinheiro. Escolha outra forma de pagamento."
    );
  });

  it("trata ausência da coluna como habilitado — compatibilidade com produtos legados/mocks incompletos", () => {
    const productSemColunas = { name: "Produto antigo, migração ainda não rodou no mock" };
    expect(() => assertPaymentMethodEnabled(productSemColunas, "PIX")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(productSemColunas, "CARTAO")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(productSemColunas, "BOLETO")).not.toThrow();
    expect(() => assertPaymentMethodEnabled(productSemColunas, "DINHEIRO")).not.toThrow();
  });

  it("não é enganado por manipulação de string 'false' vinda de SQL cru — só true literal habilita", () => {
    // Postgres via node-postgres normalmente já devolve boolean nativo, mas
    // testamos a robustez contra strings também, para não confiar apenas no
    // formato de um driver específico.
    const product = { pix_enabled: "false" };
    expect(() => assertPaymentMethodEnabled(product, "PIX")).toThrow(/Pix/);
  });
});

describe("buildOrderFilterConditions — filtros dinâmicos do dashboard", () => {
  it("sem filtros retorna nenhuma condição (comportamento anterior preservado)", () => {
    expect(buildOrderFilterConditions(undefined)).toHaveLength(0);
    expect(buildOrderFilterConditions({})).toHaveLength(0);
  });

  it("adiciona uma condição por dimensão de filtro informada", () => {
    const conditions = buildOrderFilterConditions({
      dateFrom: "2026-09-01T00:00:00.000Z",
      dateTo: "2026-09-04T23:59:59.999Z",
      status: ["PAGO", "CANCELADO"],
      productId: [1, 2],
      sellerId: [5],
      customerId: [10, 11, 12],
    });
    // dateFrom + dateTo + status + productId + sellerId + customerId = 6
    expect(conditions).toHaveLength(6);
  });

  it("ignora datas inválidas em vez de quebrar a query", () => {
    const conditions = buildOrderFilterConditions({ dateFrom: "não-é-uma-data" });
    expect(conditions).toHaveLength(0);
  });

  it("ignora arrays vazios (não gera condição 'IN ()' inválida)", () => {
    const conditions = buildOrderFilterConditions({
      status: [],
      productId: [],
      sellerId: [],
      customerId: [],
    });
    expect(conditions).toHaveLength(0);
  });
});
