import { describe, expect, test } from "bun:test";
import {
  EVENT_DATE_INVALID,
  EVENT_DATE_PAST,
  EVENT_PLACE_REQUIRED,
  HOUR_INVALID,
  KICKOFF_REQUIRED,
  MINUTE_INVALID,
  PLACE_TOO_LONG,
  PRICE_INVALID,
  PRICE_REQUIRED,
  SPOT_LIMIT_TOO_BIG,
  eventSpotLimitTooSmall,
} from "../../utils/racha-messages";
import {
  buildEventSchema,
  isoDateToMask,
  kickoffFromStartsAt,
  TEventForm,
} from "./event-schema";

const TODAY = "2026-10-01";

const valid: TEventForm = {
  startsOn: "01/10/2026",
  kickoffHour: 19,
  kickoffMinute: 0,
  place: "Quadra do Zé",
  isPaid: false,
  price: null,
  spotLimit: null,
};

const messages = (outfieldPerTeam: number, patch: Partial<TEventForm>) => {
  const result = buildEventSchema(outfieldPerTeam, TODAY).safeParse({
    ...valid,
    ...patch,
  });
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.message);
};

const passes = (outfieldPerTeam: number, patch: Partial<TEventForm> = {}) =>
  buildEventSchema(outfieldPerTeam, TODAY).safeParse({ ...valid, ...patch })
    .success;

const dateMessages = (startsOn: string) =>
  messages(5, { startsOn }).filter(
    (message) => message === EVENT_DATE_PAST || message === EVENT_DATE_INVALID
  );

describe("data", () => {
  test("vazia ou incompleta bloqueia sem frase de data", () => {
    expect(passes(5, { startsOn: "" })).toBe(false);
    expect(passes(5, { startsOn: "01/10" })).toBe(false);
    expect(dateMessages("")).toEqual([]);
    expect(dateMessages("01/10")).toEqual([]);
  });

  test("data impossível pede para conferir", () => {
    expect(messages(5, { startsOn: "31/02/2026" })).toContain(
      EVENT_DATE_INVALID
    );
    expect(messages(5, { startsOn: "31/02/2026" })).not.toContain(
      EVENT_DATE_PAST
    );
    expect(messages(5, { startsOn: "31/02/2027" })).toContain(
      EVENT_DATE_INVALID
    );
  });

  test("ontem bloqueia e hoje passa", () => {
    expect(messages(5, { startsOn: "30/09/2026" })).toContain(EVENT_DATE_PAST);
    expect(passes(5, { startsOn: "01/10/2026" })).toBe(true);
    expect(passes(5, { startsOn: "02/10/2026" })).toBe(true);
  });

  test("hoje com horário passado não pode ser agendado", () => {
    const now = "2026-10-01T23:05:11";
    const past = buildEventSchema(5, now).safeParse(valid);
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(past.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["slot"],
          message: "O horário precisa ser no futuro.",
        })
      );
    }

    expect(
      buildEventSchema(5, now).safeParse({
        ...valid,
        kickoffHour: 23,
        kickoffMinute: 6,
      }).success
    ).toBe(true);
    expect(buildEventSchema(5, now, false).safeParse(valid).success).toBe(true);
  });
});

describe("horário", () => {
  test("falta hora ou minuto", () => {
    expect(messages(5, { kickoffHour: null, kickoffMinute: null })).toContain(
      KICKOFF_REQUIRED
    );
    expect(messages(5, { kickoffHour: 19, kickoffMinute: null })).toContain(
      KICKOFF_REQUIRED
    );
    expect(messages(5, { kickoffHour: null, kickoffMinute: 0 })).toContain(
      KICKOFF_REQUIRED
    );
  });

  test("hora 24 e minuto 60", () => {
    expect(messages(5, { kickoffHour: 24, kickoffMinute: 0 })).toContain(
      HOUR_INVALID
    );
    expect(messages(5, { kickoffHour: 19, kickoffMinute: 60 })).toContain(
      MINUTE_INVALID
    );
  });

  test("meia-noite de amanhã passa", () => {
    expect(
      passes(5, {
        startsOn: "02/10/2026",
        kickoffHour: 0,
        kickoffMinute: 0,
      })
    ).toBe(true);
  });
});

describe("local", () => {
  test("vazio ou A definir pede o local do jogo", () => {
    expect(messages(5, { place: "" })).toContain(EVENT_PLACE_REQUIRED);
    expect(messages(5, { place: "   " })).toContain(EVENT_PLACE_REQUIRED);
    expect(messages(5, { place: "A definir" })).toContain(EVENT_PLACE_REQUIRED);
    expect(messages(5, { place: "  A definir  " })).toContain(
      EVENT_PLACE_REQUIRED
    );
  });

  test("121 caracteres estoura o teto", () => {
    expect(messages(5, { place: "a".repeat(121) })).toContain(PLACE_TOO_LONG);
  });

  test("espaço nas pontas não vai para o banco", () => {
    const result = buildEventSchema(5, TODAY).safeParse({
      ...valid,
      place: "  Quadra  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.place).toBe("Quadra");
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

  test("pago desligado conserva um valor já gravado", () => {
    expect(passes(5, { isPaid: false, price: 25 })).toBe(true);
  });
});

describe("vagas", () => {
  test("8 com linha 5 pede o mínimo", () => {
    expect(messages(5, { spotLimit: 8 })).toContain(eventSpotLimitTooSmall(10));
  });

  test("vazio e o piso passam", () => {
    expect(passes(5, { spotLimit: null })).toBe(true);
    expect(passes(5, { spotLimit: 10 })).toBe(true);
  });

  test("linha 6 pede 12", () => {
    expect(messages(6, { spotLimit: 10 })).toContain(
      eventSpotLimitTooSmall(12)
    );
    expect(passes(6, { spotLimit: 12 })).toBe(true);
  });

  test("32768 estoura o smallint", () => {
    expect(messages(5, { spotLimit: 32768 })).toContain(SPOT_LIMIT_TOO_BIG);
  });
});

describe("leitura do evento", () => {
  test("ISO vira a máscara e meia-noite continua 0", () => {
    expect(isoDateToMask("2026-10-08")).toBe("08/10/2026");
    expect(kickoffFromStartsAt("19:00:00")).toEqual({
      kickoffHour: 19,
      kickoffMinute: 0,
    });
    expect(kickoffFromStartsAt("00:05:00")).toEqual({
      kickoffHour: 0,
      kickoffMinute: 5,
    });
  });
});
