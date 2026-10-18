import { describe, expect, test } from "bun:test";
import { emailCodeError } from "./email-code-error";

describe("emailCodeError", () => {
  test("otp_expired (errado, usado ou vencido) vira invalid", () => {
    expect(emailCodeError({ code: "otp_expired", status: 403 })).toBe(
      "invalid"
    );
  });

  test("limite de envio e status 429 viram rateLimited", () => {
    expect(
      emailCodeError({ code: "over_email_send_rate_limit", status: 429 })
    ).toBe("rateLimited");
    expect(emailCodeError({ status: 429 })).toBe("rateLimited");
  });

  test("o resto vira sendFailed", () => {
    expect(emailCodeError({ code: "unexpected_failure", status: 500 })).toBe(
      "sendFailed"
    );
    expect(emailCodeError(new Error("Network request failed"))).toBe(
      "sendFailed"
    );
    expect(emailCodeError(null)).toBe("sendFailed");
  });

  test("falha da RPC depois do código aceito vira confirmFailed", () => {
    expect(emailCodeError(new Error("x"), "confirm")).toBe("confirmFailed");
    expect(emailCodeError({ code: "otp_expired" }, "confirm")).toBe(
      "confirmFailed"
    );
  });
});
