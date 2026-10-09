import { describe, expect, test } from "bun:test";
import { dayGroup, relativeWhen } from "./when";

// Instantes em UTC. 03:30Z é 00:30 em Brasília; 02:30Z do mesmo dia civil UTC
// ainda é 23:30 do dia anterior em Brasília. Os dois cairiam na segunda se
// o código usasse o fuso do processo em UTC.
const MONDAY_0030_BRT = "2026-10-12T03:30:00.000Z";
const SUNDAY_2330_BRT = "2026-10-12T02:30:00.000Z";
const MONDAY_OF_THAT_WEEK_0030_BRT = "2026-10-05T03:30:00.000Z";

describe("relativeWhen", () => {
  const noonMonday = new Date("2026-10-12T15:00:00.000Z");

  test("59 s é agora e 60 s é há 1 min", () => {
    expect(
      relativeWhen(
        new Date(noonMonday.getTime() - 59_000).toISOString(),
        noonMonday
      )
    ).toBe("agora");
    expect(
      relativeWhen(
        new Date(noonMonday.getTime() - 60_000).toISOString(),
        noonMonday
      )
    ).toBe("há 1 min");
  });

  test("59 min continua em minutos", () => {
    expect(
      relativeWhen(
        new Date(noonMonday.getTime() - 59 * 60_000).toISOString(),
        noonMonday
      )
    ).toBe("há 59 min");
  });

  test("uma hora no mesmo dia civil é há N h; atravessando a meia-noite é ontem", () => {
    const monday0030 = new Date(MONDAY_0030_BRT);
    expect(relativeWhen(SUNDAY_2330_BRT, monday0030)).toBe("ontem");

    const monday0200 = new Date("2026-10-12T05:00:00.000Z");
    expect(relativeWhen("2026-10-12T04:00:00.000Z", monday0200)).toBe("há 1 h");
  });

  test("hora inteira, mínimo 1", () => {
    expect(
      relativeWhen(
        new Date(noonMonday.getTime() - 90 * 60_000).toISOString(),
        noonMonday
      )
    ).toBe("há 1 h");
  });

  test("mais antigo usa o dia civil de Brasília, não o do instante UTC", () => {
    // 01:30Z de domingo ainda é sábado 22:30 em Brasília.
    expect(relativeWhen("2026-10-04T01:30:00.000Z", noonMonday)).toBe(
      "sáb 03/10"
    );
  });

  test("menos de uma hora atravessa a meia-noite e segue em minutos", () => {
    const monday0030 = new Date(MONDAY_0030_BRT);
    expect(relativeWhen("2026-10-12T02:31:00.000Z", monday0030)).toBe(
      "há 59 min"
    );
  });
});

describe("dayGroup", () => {
  test("segunda 00:30 vs domingo 23:30 muda com o now", () => {
    const monday0030 = new Date(MONDAY_0030_BRT);
    expect(dayGroup(SUNDAY_2330_BRT, monday0030)).toBe("yesterday");
    expect(dayGroup(MONDAY_0030_BRT, monday0030)).toBe("today");

    const sunday2330 = new Date(SUNDAY_2330_BRT);
    expect(dayGroup(MONDAY_OF_THAT_WEEK_0030_BRT, sunday2330)).toBe("thisWeek");

    const wednesdayNoon = new Date("2026-10-14T15:00:00.000Z");
    expect(dayGroup(MONDAY_0030_BRT, wednesdayNoon)).toBe("thisWeek");
    expect(dayGroup(SUNDAY_2330_BRT, wednesdayNoon)).toBe("earlier");
    expect(dayGroup("2026-10-13T15:00:00.000Z", wednesdayNoon)).toBe(
      "yesterday"
    );
  });
});
