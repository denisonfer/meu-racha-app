import { describe, expect, test } from "bun:test";
import type { TPayment } from "../racha-types";
import { paymentView } from "./payment-view";

const base: TPayment = {
  dailyPrice: 25,
  creditAvailable: 0,
  creditBalance: 0,
  amountDue: 25,
  isPaid: false,
  isWaitlisted: false,
  isOwner: false,
  recipientName: "Ana Paula",
  pixKey: "ana@x.com",
  pixKeyType: "email",
};

describe("paymentView", () => {
  test("sem Crédito: due com uma linha e o QR da diária", () => {
    const view = paymentView(base);
    expect(view.kind).toBe("due");
    expect(view.amountDue).toBe(25);
    expect(view.rows).toEqual([
      { label: "A pagar", value: "R$ 25", isTotal: true },
    ]);
    expect(view.brCode).toContain("540525.00");
  });

  test("Crédito parcial: Diária, Crédito e A pagar; o QR leva o líquido", () => {
    const view = paymentView({
      ...base,
      creditAvailable: 10,
      creditBalance: 10,
      amountDue: 15,
    });
    expect(view.kind).toBe("due");
    expect(view.rows).toEqual([
      { label: "Diária", value: "R$ 25" },
      { label: "Crédito", value: "−R$ 10" },
      { label: "A pagar", value: "R$ 15", isTotal: true },
    ]);
    expect(view.brCode).toContain("540515.00");
  });

  test("Crédito que cobre a diária: coveredByCredit, sem QR e com as sobras", () => {
    const view = paymentView({
      ...base,
      creditAvailable: 25,
      creditBalance: 40,
      amountDue: 0,
    });
    expect(view.kind).toBe("coveredByCredit");
    expect(view.brCode).toBeNull();
    expect(view.creditLeft).toBe(15);
    expect(view.rows.at(-1)).toEqual({
      label: "A pagar",
      value: "R$ 0",
      isTotal: true,
    });
  });

  test("sem chave: noKey e sem QR, mantendo o valor", () => {
    const view = paymentView({ ...base, pixKey: null, pixKeyType: null });
    expect(view.kind).toBe("noKey");
    expect(view.amountDue).toBe(25);
    expect(view.brCode).toBeNull();
  });

  test("pago vence tudo, mesmo com valor devido ainda no retorno", () => {
    const view = paymentView({ ...base, isPaid: true });
    expect(view.kind).toBe("paid");
    expect(view.brCode).toBeNull();
    expect(view.rows).toEqual([]);
  });
});
