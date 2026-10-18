import { buildPixBrCode } from "@meu-racha/domain";
import type { TPayment } from "../racha-types";
import { PAY_DUE, PAY_ROW_CREDIT, PAY_ROW_DAILY } from "./racha-messages";

export type TPaymentRow = { label: string; value: string; isTotal?: boolean };

export type TPaymentView = {
  kind: "due" | "coveredByCredit" | "noKey" | "paid";
  amountDue: number;
  /** Crédito que sobra depois de pagar a diária (só em `coveredByCredit`). */
  creditLeft: number;
  rows: TPaymentRow[];
  brCode: string | null;
};

const reais = (value: number) => `R$ ${value}`;

export function paymentView(payment: TPayment): TPaymentView {
  const { dailyPrice, amountDue, pixKey, pixKeyType } = payment;

  // o banco devolve o valor devido mesmo depois de pago: is_paid decide primeiro
  if (payment.isPaid) {
    return {
      kind: "paid",
      amountDue: 0,
      creditLeft: 0,
      rows: [],
      brCode: null,
    };
  }

  const creditApplied = dailyPrice - amountDue;
  const total: TPaymentRow = {
    label: PAY_DUE,
    value: reais(amountDue),
    isTotal: true,
  };
  const rows: TPaymentRow[] =
    creditApplied > 0
      ? [
          { label: PAY_ROW_DAILY, value: reais(dailyPrice) },
          { label: PAY_ROW_CREDIT, value: `−${reais(creditApplied)}` },
          total,
        ]
      : [total];

  if (amountDue <= 0) {
    return {
      kind: "coveredByCredit",
      amountDue: 0,
      creditLeft: payment.creditBalance - dailyPrice,
      rows,
      brCode: null,
    };
  }
  if (!pixKey || !pixKeyType) {
    return { kind: "noKey", amountDue, creditLeft: 0, rows, brCode: null };
  }
  return {
    kind: "due",
    amountDue,
    creditLeft: 0,
    rows,
    brCode: buildPixBrCode({
      key: pixKey,
      name: payment.recipientName,
      amountCents: amountDue * 100,
    }),
  };
}
