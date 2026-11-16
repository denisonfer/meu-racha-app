import type { TEnvironmentName } from "@/lib/resolve-environment";

export const IS_PRO_SALE_OPEN = false;

// Venda fechada ainda deixa o Homolog comprar, para testar com o sandbox da Play.
export function isPurchaseAvailable(args: {
  os: string;
  envName: TEnvironmentName;
  revenuecatKey?: string;
  isSaleOpen: boolean;
}): boolean {
  return (
    args.os === "android" &&
    Boolean(args.revenuecatKey) &&
    (args.isSaleOpen || args.envName === "staging")
  );
}

export function playSubscriptionsUrl(productId: string | null): string {
  const url =
    "https://play.google.com/store/account/subscriptions?package=app.meuracha";
  // o sku do link é só o id da assinatura, sem o plano-base ("pro:mensal" → "pro")
  return productId ? `${url}&sku=${productId.split(":")[0]}` : url;
}

const DAYS_PER_UNIT: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

// período da fase grátis da Play (PERIOD_UNIT do SDK) em dias
export function trialDays(period: {
  unit: string;
  value: number;
}): number | null {
  const days = DAYS_PER_UNIT[period.unit];
  return days ? days * period.value : null;
}
