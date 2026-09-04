import { describe, expect, it } from "vitest";
import { normalizeCpf, normalizeCustomerContact } from "./db.customers";

describe("customer contact normalization", () => {
  it("normalizes WhatsApp contacts to digits", () => {
    expect(normalizeCustomerContact("+55 (61) 99999-0000", "WHATSAPP")).toBe(
      "5561999990000"
    );
  });

  it("normalizes email contacts case-insensitively", () => {
    expect(normalizeCustomerContact("  Cliente@Exemplo.COM ", "EMAIL")).toBe(
      "cliente@exemplo.com"
    );
  });

  it("detects an email even when contact type is omitted", () => {
    expect(normalizeCustomerContact("Client@Example.com")).toBe(
      "client@example.com"
    );
  });
});

describe("customer CPF normalization", () => {
  it("strips formatting characters", () => {
    expect(normalizeCpf("123.456.789-00")).toBe("12345678900");
  });

  it("returns null for empty/undefined values", () => {
    expect(normalizeCpf(undefined)).toBeNull();
    expect(normalizeCpf(null)).toBeNull();
    expect(normalizeCpf("")).toBeNull();
  });
});
