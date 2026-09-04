import { describe, expect, it } from "vitest";
import { formatTimeRemaining, isExpired } from "./reservationExpiry";

describe("reservationExpiry", () => {
  it("marca como expirado quando a data já passou", () => {
    const past = new Date(Date.now() - 60_000);
    expect(isExpired(past)).toBe(true);
    expect(formatTimeRemaining(past)).toBe("Expirada");
  });

  it("não marca como expirado quando a data ainda não chegou", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isExpired(future)).toBe(false);
  });

  it("formata horas e minutos restantes", () => {
    const future = new Date(Date.now() + (2 * 60 + 15) * 60_000);
    expect(formatTimeRemaining(future)).toBe("Expira em 2h 15min");
  });

  it("formata só minutos quando falta menos de 1 hora", () => {
    const future = new Date(Date.now() + 30 * 60_000);
    expect(formatTimeRemaining(future)).toBe("Expira em 30min");
  });

  it("retorna vazio sem data", () => {
    expect(formatTimeRemaining(null)).toBe("");
    expect(isExpired(undefined)).toBe(false);
  });
});
