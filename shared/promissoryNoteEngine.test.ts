import { describe, expect, it } from "vitest";
import {
  computeFirstDueDate,
  computeInstallmentSchedule,
} from "./promissoryNoteEngine";

describe("computeFirstDueDate", () => {
  it("soma os dias configurados à data da compra", () => {
    const purchase = new Date("2026-08-15T12:00:00.000Z");
    const due = computeFirstDueDate(purchase, 30);
    expect(due.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  it("usa 30 dias como padrão quando o valor configurado é inválido", () => {
    const purchase = new Date("2026-08-15T12:00:00.000Z");
    const due = computeFirstDueDate(purchase, 0);
    expect(due.toISOString().slice(0, 10)).toBe("2026-09-14");
  });
});

describe("computeInstallmentSchedule", () => {
  it("gera N parcelas mensais cuja soma bate exatamente com o total", () => {
    const firstDue = new Date("2026-09-15T00:00:00.000Z");
    const items = computeInstallmentSchedule(1400, 4, firstDue);

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      installmentNumber: 1,
      installmentsTotal: 4,
      amount: 350,
    });
    expect(items[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(items[1]!.dueDate.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(items[2]!.dueDate.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(items[3]!.dueDate.toISOString().slice(0, 10)).toBe("2026-12-15");

    const sum = items.reduce((acc, item) => acc + item.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(1400);
  });

  it("concentra o resíduo de centavos na última parcela", () => {
    const firstDue = new Date("2026-09-15T00:00:00.000Z");
    const items = computeInstallmentSchedule(100, 3, firstDue);
    expect(items.map(i => i.amount)).toEqual([33.33, 33.33, 33.34]);
    const sum = items.reduce((acc, item) => acc + item.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });

  it("preserva o dia do vencimento ao virar mês mais curto (31 -> 28/29)", () => {
    const firstDue = new Date("2026-01-31T00:00:00.000Z");
    const items = computeInstallmentSchedule(300, 3, firstDue);
    expect(items[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(items[1]!.dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(items[2]!.dueDate.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("gera uma única nota quando não há parcelamento (1x)", () => {
    const firstDue = new Date("2026-09-15T00:00:00.000Z");
    const items = computeInstallmentSchedule(500, 1, firstDue);
    expect(items).toHaveLength(1);
    expect(items[0]!.amount).toBe(500);
  });

  it("rejeita valor total inválido", () => {
    expect(() =>
      computeInstallmentSchedule(0, 3, new Date())
    ).toThrow();
  });
});
