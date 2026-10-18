import { describe, expect, test } from "bun:test";
import { buildPixBrCode } from "./br-code";

// CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF), recalculado aqui de forma independente da implementação.
function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

// Os campos do BR Code a partir da string, para os testes não dependerem de posição.
function parse(code: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < code.length;) {
    const len = Number(code.slice(i + 2, i + 4));
    out[code.slice(i, i + 2)] = code.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

describe("buildPixBrCode", () => {
  test("caso de referência: string exata", () => {
    // Montada à mão, campo a campo, segundo o Manual do BR Code do Bacen (TLV EMV, ids 00/26/52/53/54/58/59/60/62/63):
    //   00 02 01 | 26 .. (00 14 br.gov.bcb.pix, 01 18 fulano@exemplo.com) | 52 04 0000 | 53 03 986
    //   | 54 05 15.00 | 58 02 BR | 59 13 FULANO DE TAL | 60 06 BRASIL | 62 07 (05 03 ***) | 63 04 + CRC.
    // O CRC (0x1021, inicial 0xFFFF) foi calculado fora do código sob teste, com Python
    // (binascii.crc_hqx(payload, 0xFFFF)), e colado literalmente abaixo.
    const expected =
      "00020126400014br.gov.bcb.pix0118fulano@exemplo.com5204000053039865405" +
      "15.005802BR5913FULANO DE TAL6006BRASIL62070503***6304";
    expect(
      buildPixBrCode({
        key: "fulano@exemplo.com",
        name: "FULANO DE TAL",
        amountCents: 1500,
      })
    ).toBe(`${expected}A4C2`);
    expect(crc16(expected)).toBe("A4C2");
  });

  test("nome sem acento, em maiúsculas e cortado em 25", () => {
    const code = buildPixBrCode({
      key: "a@b.co",
      name: "João Conceição da Silva Júnior",
      amountCents: 100,
    });
    expect(parse(code)["59"]).toBe("JOAO CONCEICAO DA SILVA J");
    expect(parse(code)["59"]).toHaveLength(25);
  });

  test("emoji e símbolos não ASCII saem do nome", () => {
    const code = buildPixBrCode({
      key: "a@b.co",
      name: "Zé ⚽ Bola",
      amountCents: 100,
    });
    expect(parse(code)["59"]).toBe("ZE  BOLA");
  });

  test("nome que some na limpeza vira RECEBEDOR", () => {
    const code = buildPixBrCode({
      key: "a@b.co",
      name: "⚽",
      amountCents: 100,
    });
    expect(parse(code)["59"]).toBe("RECEBEDOR");
  });

  test("CRC dos 4 últimos caracteres confere", () => {
    for (const name of ["Ana", "João Conceição da Silva Júnior"]) {
      const code = buildPixBrCode({
        key: "+5511999999999",
        name,
        amountCents: 2500,
      });
      expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
      expect(code.slice(-8, -4)).toBe("6304");
    }
  });

  test("valor sai com duas casas", () => {
    const amount = (cents: number) =>
      parse(buildPixBrCode({ key: "a@b.co", name: "Ana", amountCents: cents }))[
        "54"
      ];
    expect(amount(2500)).toBe("25.00");
    expect(amount(5)).toBe("0.05");
    expect(amount(123456)).toBe("1234.56");
  });

  test("a chave vai no campo 26 com o GUI", () => {
    const code = buildPixBrCode({
      key: "a@b.co",
      name: "Ana",
      amountCents: 100,
    });
    expect(code.startsWith("000201")).toBe(true);
    expect(parse(code)["26"]).toBe(
      tlv("00", "br.gov.bcb.pix") + tlv("01", "a@b.co")
    );
    expect(parse(code)["62"]).toBe("0503***");
  });
});
