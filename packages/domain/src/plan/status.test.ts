import { describe, expect, test } from "bun:test";
import { getPlanStatus, TMyPlan } from "./status";

const NOW = new Date("2026-11-13T12:00:00Z");
const FUTURE = new Date("2026-12-13T12:00:00Z");

const PRO: TMyPlan = {
  isPro: true,
  expiresAt: FUTURE,
  isTrial: false,
  willRenew: true,
  billingIssueAt: null,
  productId: "pro_monthly",
  ownedRachaCount: 1,
  canCreateRacha: true,
};

describe("getPlanStatus", () => {
  test("sem expiração ou já expirado é free", () => {
    expect(getPlanStatus({ ...PRO, expiresAt: null }, NOW)).toEqual({
      kind: "free",
    });
    expect(getPlanStatus({ ...PRO, expiresAt: NOW }, NOW)).toEqual({
      kind: "free",
    });
    expect(
      getPlanStatus({ ...PRO, expiresAt: new Date("2026-01-01") }, NOW)
    ).toEqual({ kind: "free" });
  });

  test("problema de cobrança vence o período de teste", () => {
    const billingIssueAt = new Date("2026-11-10T00:00:00Z");
    expect(
      getPlanStatus({ ...PRO, isTrial: true, billingIssueAt }, NOW)
    ).toEqual({ kind: "billing_issue", until: FUTURE });
  });

  test("teste, cancelado e renovando", () => {
    expect(getPlanStatus({ ...PRO, isTrial: true }, NOW)).toEqual({
      kind: "trial",
      until: FUTURE,
    });
    expect(getPlanStatus({ ...PRO, willRenew: false }, NOW)).toEqual({
      kind: "ending",
      until: FUTURE,
    });
    expect(getPlanStatus(PRO, NOW)).toEqual({
      kind: "renewing",
      until: FUTURE,
    });
  });
});
