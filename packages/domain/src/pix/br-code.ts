function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

// CRC16-CCITT-FALSE: polinômio 0x1021, inicial 0xFFFF, como exige o BR Code.
function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// O campo 59 aceita só ASCII imprimível e até 25 caracteres.
function receiverName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .toUpperCase()
      .slice(0, 25) || "RECEBEDOR"
  );
}

/** BR Code estático (PIX copia e cola) com valor fixo; `key` já normalizada. */
export function buildPixBrCode(input: {
  key: string;
  name: string;
  amountCents: number;
}): string {
  const amount = (input.amountCents / 100).toFixed(2);
  const body =
    tlv("00", "01") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", input.key)) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", receiverName(input.name)) +
    tlv("60", "BRASIL") +
    tlv("62", tlv("05", "***")) +
    "6304";
  return body + crc16(body);
}
