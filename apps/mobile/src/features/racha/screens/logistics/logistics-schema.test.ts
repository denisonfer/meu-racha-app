import { describe, expect, test } from "bun:test";
import {
  HOUR_INVALID,
  KICKOFF_REQUIRED,
  MINUTE_INVALID,
  MONTHLY_PRICE_INVALID,
  PLACE_REQUIRED,
  PLACE_TOO_LONG,
  PAYER_TARGET_INVALID,
  PAYER_TARGET_REQUIRED,
  PRICE_INVALID,
  PRICE_REQUIRED,
  SPOT_LIMIT_TOO_BIG,
  WEEKDAY_REQUIRED,
  spotLimitTooSmall,
} from "../../utils/racha-messages";
import { buildLogisticsSchema, TLogisticsForm } from "./logistics-schema";

const valid: TLogisticsForm = {
  place: "A definir",
  weekday: null,
  kickoffHour: null,
  kickoffMinute: null,
  minAge: null,
  isPaid: false,
  price: null,
  monthlyPrice: null,
  spotLimit: null,
  payerTarget: null,
};

const messages = (outfieldPerTeam: number, patch: Partial<TLogisticsForm>) => {
  const result = buildLogisticsSchema(outfieldPerTeam).safeParse({
    ...valid,
    ...patch,
  });
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
};

const passes = (outfieldPerTeam: number, patch: Partial<TLogisticsForm> = {}) =>
  buildLogisticsSchema(outfieldPerTeam).safeParse({ ...valid, ...patch })
    .success;

describe("local", () => {
  test("vazio ou só espaço pede o local", () => {
    expect(messages(5, { place: "" })).toContain(PLACE_REQUIRED);
    expect(messages(5, { place: "   " })).toContain(PLACE_REQUIRED);
  });

  test("121 caracteres estoura o teto", () => {
    expect(messages(5, { place: "a".repeat(121) })).toContain(PLACE_TOO_LONG);
  });

  test("A definir passa", () => {
    expect(passes(5)).toBe(true);
  });

  test("espaço nas pontas não vai para o banco", () => {
    const result = buildLogisticsSchema(5).safeParse({
      ...valid,
      place: "  Quadra  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.place).toBe("Quadra");
  });
});

describe("dia e horário", () => {
  test("dia sem hora ou sem minuto pede o horário", () => {
    expect(
      messages(5, { weekday: 3, kickoffHour: null, kickoffMinute: 0 })
    ).toContain(KICKOFF_REQUIRED);
    expect(
      messages(5, { weekday: 3, kickoffHour: 19, kickoffMinute: null })
    ).toContain(KICKOFF_REQUIRED);
  });

  test("hora e minuto sem dia pedem o dia", () => {
    expect(
      messages(5, { weekday: null, kickoffHour: 19, kickoffMinute: 0 })
    ).toContain(WEEKDAY_REQUIRED);
  });

  test("os dois vazios passa", () => {
    expect(
      passes(5, { weekday: null, kickoffHour: null, kickoffMinute: null })
    ).toBe(true);
  });

  test("só a hora, sem minuto e sem dia, pede o horário", () => {
    expect(
      messages(5, { weekday: null, kickoffHour: 19, kickoffMinute: null })
    ).toContain(KICKOFF_REQUIRED);
  });

  test("hora 24 e minuto 60", () => {
    expect(
      messages(5, { weekday: 1, kickoffHour: 24, kickoffMinute: 0 })
    ).toContain(HOUR_INVALID);
    expect(
      messages(5, { weekday: 1, kickoffHour: 19, kickoffMinute: 60 })
    ).toContain(MINUTE_INVALID);
  });

  test("meia-noite com um dia passa", () => {
    expect(passes(5, { weekday: 1, kickoffHour: 0, kickoffMinute: 0 })).toBe(
      true
    );
  });
});

describe("pago", () => {
  test("pago sem valor pede o valor", () => {
    expect(messages(5, { isPaid: true, price: null })).toContain(
      PRICE_REQUIRED
    );
  });

  test("valor 0 ou 10000 está fora da faixa", () => {
    expect(messages(5, { isPaid: true, price: 0 })).toContain(PRICE_INVALID);
    expect(messages(5, { isPaid: true, price: 10000 })).toContain(
      PRICE_INVALID
    );
  });

  test("mensal 0 está fora; mensal vazio passa", () => {
    expect(
      messages(5, { isPaid: true, price: 25, monthlyPrice: 0, payerTarget: 1 })
    ).toContain(MONTHLY_PRICE_INVALID);
    expect(
      passes(5, {
        isPaid: true,
        price: 25,
        monthlyPrice: null,
        payerTarget: 1,
      })
    ).toBe(true);
  });

  test("pago desligado conserva um valor já gravado", () => {
    expect(passes(5, { isPaid: false, price: 25, monthlyPrice: 40 })).toBe(
      true
    );
  });

  test("pago sem meta pede a meta", () => {
    expect(
      messages(5, { isPaid: true, price: 25, payerTarget: null })
    ).toContain(PAYER_TARGET_REQUIRED);
  });

  test("meta 0 ou negativa falha; 1 passa", () => {
    expect(messages(5, { isPaid: true, price: 25, payerTarget: 0 })).toContain(
      PAYER_TARGET_INVALID
    );
    expect(passes(5, { isPaid: true, price: 25, payerTarget: 1 })).toBe(true);
  });

  test("grátis sem meta passa", () => {
    expect(passes(5, { isPaid: false, payerTarget: null })).toBe(true);
  });
});

describe("vagas", () => {
  test("8 com linha 5 pede pelo menos o dobro", () => {
    expect(messages(5, { spotLimit: 8 })).toContain(spotLimitTooSmall(10));
  });

  test("vazio e o piso passam", () => {
    expect(passes(5, { spotLimit: null })).toBe(true);
    expect(passes(5, { spotLimit: 10 })).toBe(true);
  });

  test("32768 estoura o smallint", () => {
    expect(messages(5, { spotLimit: 32768 })).toContain(SPOT_LIMIT_TOO_BIG);
  });
});
