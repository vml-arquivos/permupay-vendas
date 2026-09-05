import { describe, expect, it } from "vitest";
import { resolveProductPaymentMethodFlags } from "./db";

/**
 * Cobre a lógica de herança das formas de pagamento de um produto novo
 * (Configurações de Pagamento → "Formas de pagamento ativas" → padrão para
 * produtos novos). Função pura extraída de createProduct especificamente
 * para poder ser testada sem precisar de banco de dados.
 *
 * Regra: campo explícito no payload (mesmo `false`) sempre vence; campo
 * ausente/undefined herda o padrão global atual.
 */
describe("resolveProductPaymentMethodFlags", () => {
  it("herda o padrão global quando o produto não especifica nada", () => {
    const result = resolveProductPaymentMethodFlags(
      {},
      { pixEnabled: true, cardEnabled: false, boletoEnabled: true, cashEnabled: false }
    );
    expect(result).toEqual({
      pixEnabled: true,
      cardEnabled: false,
      boletoEnabled: true,
      cashEnabled: false,
    });
  });

  it("usa o valor explícito do produto mesmo quando o global diverge", () => {
    const result = resolveProductPaymentMethodFlags(
      { pixEnabled: false, cardEnabled: true },
      { pixEnabled: true, cardEnabled: false, boletoEnabled: true, cashEnabled: true }
    );
    expect(result.pixEnabled).toBe(false);
    expect(result.cardEnabled).toBe(true);
    // boletoEnabled/cashEnabled não vieram no payload — herdam do global
    expect(result.boletoEnabled).toBe(true);
    expect(result.cashEnabled).toBe(true);
  });

  it("aceita explicitamente `false` no produto (não confunde com 'não informado')", () => {
    const result = resolveProductPaymentMethodFlags(
      { pixEnabled: false, cardEnabled: false, boletoEnabled: false, cashEnabled: false },
      { pixEnabled: true, cardEnabled: true, boletoEnabled: true, cashEnabled: true }
    );
    expect(result).toEqual({
      pixEnabled: false,
      cardEnabled: false,
      boletoEnabled: false,
      cashEnabled: false,
    });
  });

  it("cai para `true` (comportamento anterior) quando nem o produto nem o global informam nada", () => {
    const result = resolveProductPaymentMethodFlags({}, {});
    expect(result).toEqual({
      pixEnabled: true,
      cardEnabled: true,
      boletoEnabled: true,
      cashEnabled: true,
    });
  });

  it("trata null no global igual a 'não informado' (herda true)", () => {
    const result = resolveProductPaymentMethodFlags(
      {},
      { pixEnabled: null, cardEnabled: null, boletoEnabled: null, cashEnabled: null }
    );
    expect(result).toEqual({
      pixEnabled: true,
      cardEnabled: true,
      boletoEnabled: true,
      cashEnabled: true,
    });
  });
});
