// reais inteiros: a coluna guarda o número, a máscara só mostra R$ e o ponto de milhar
const MAX_DIGITS = 5;

export function applyBrlMask(value: string): string {
  const digits = value
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_DIGITS);

  if (!digits) return "";

  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped}`;
}
