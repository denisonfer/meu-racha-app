import { describe, expect, test } from "bun:test";
import {
  buildGuestFormSchema,
  emptyGuestForm,
  guestPositionDetail,
  type TGuestFormValues,
} from "./guest-schema";

const guest = (patch: Partial<TGuestFormValues>): TGuestFormValues => ({
  ...emptyGuestForm(),
  displayName: "Léo Ribeiro",
  stars: 3,
  ...patch,
});

const issuePaths = (asks: boolean, values: TGuestFormValues) => {
  const result = buildGuestFormSchema(asks).safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

describe("Avulso em Evento 8+", () => {
  test("DEF e MEI pedem a subdivisão de cada zona", () => {
    const values = guest({
      primaryPosition: "MIDFIELDER",
      secondaryPosition: "DEFENDER",
    });
    expect(issuePaths(true, values)).toEqual([
      "primaryPositionDetail",
      "secondaryPositionDetail",
    ]);
    expect(
      issuePaths(true, {
        ...values,
        primaryPositionDetail: "DEFENSIVE_MID",
        secondaryPositionDetail: "FULL_BACK",
      })
    ).toEqual([]);
  });

  test("subdivisão de outra zona não passa", () => {
    expect(
      issuePaths(
        true,
        guest({
          primaryPosition: "DEFENDER",
          secondaryPosition: "FORWARD",
          primaryPositionDetail: "ATTACKING_MID",
        })
      )
    ).toEqual(["primaryPositionDetail"]);
  });

  test("ATA, TODAS e Goleiro não pedem nada", () => {
    expect(issuePaths(true, guest({ primaryPosition: "ANY" }))).toEqual([]);
    expect(
      issuePaths(
        true,
        guest({ primaryPosition: "FORWARD", secondaryPosition: "ANY" })
      )
    ).not.toContain("secondaryPositionDetail");
    expect(
      issuePaths(true, guest({ playsAs: "GOALKEEPER", stars: null }))
    ).toEqual([]);
  });

  test("Evento 3–7 não pede subdivisão", () => {
    expect(
      issuePaths(
        false,
        guest({ primaryPosition: "DEFENDER", secondaryPosition: "MIDFIELDER" })
      )
    ).toEqual([]);
  });

  test("só envia a subdivisão no 8+ e quando cabe na zona", () => {
    expect(guestPositionDetail(true, "DEFENDER", "CENTER_BACK")).toBe(
      "CENTER_BACK"
    );
    expect(guestPositionDetail(false, "DEFENDER", "CENTER_BACK")).toBeNull();
    expect(guestPositionDetail(true, "FORWARD", "CENTER_BACK")).toBeNull();
  });
});
