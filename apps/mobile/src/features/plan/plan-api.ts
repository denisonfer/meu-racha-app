import type { TMyPlan } from "@meu-racha/domain";
import { Platform } from "react-native";
import Purchases, {
  type PurchasesError,
  type PurchasesPackage,
} from "react-native-purchases";
import { environment } from "@/lib/environment";
import { supabase } from "@/lib/supabase";
import type { TPlanOffer, TPlanPackage } from "./plan-types";
import {
  IS_PRO_SALE_OPEN,
  isPurchaseAvailable,
  trialDays,
} from "./utils/purchase-availability";

const ENTITLEMENT = "pro";
const PACKAGE_ID = { monthly: "$rc_monthly", annual: "$rc_annual" } as const;

export function purchaseAvailable(): boolean {
  return isPurchaseAvailable({
    os: Platform.OS,
    envName: environment.name,
    revenuecatKey: environment.config.revenuecatKey,
    isSaleOpen: IS_PRO_SALE_OPEN,
  });
}

// os tipos gerados marcam tudo como não nulo, mas quem nunca assinou recebe nulos
type TPlanRow = {
  is_pro: boolean;
  expires_at: string | null;
  is_trial: boolean | null;
  will_renew: boolean | null;
  billing_issue_at: string | null;
  product_id: string | null;
  owned_racha_count: number;
  can_create_racha: boolean;
};

export async function getMyPlan(): Promise<TMyPlan> {
  const { data, error } = await supabase.rpc("get_my_plan").single();
  if (error) throw error;

  const row = data as TPlanRow;
  return {
    isPro: row.is_pro,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    isTrial: row.is_trial,
    willRenew: row.will_renew,
    billingIssueAt: row.billing_issue_at
      ? new Date(row.billing_issue_at)
      : null,
    productId: row.product_id,
    ownedRachaCount: row.owned_racha_count,
    canCreateRacha: row.can_create_racha,
  };
}

// o servidor pergunta à RevenueCat e grava; o app nunca concede Pro a si mesmo
export async function syncMyPlan(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ is_pro: boolean }>(
    "revenuecat-sync",
    { method: "POST" }
  );
  if (error) throw error;
  return data?.is_pro === true;
}

// usuário que o SDK tem (ou está para ter): gravado antes do await para que
// duas chamadas seguidas não configurem nem façam logIn duas vezes
let purchasesUserId: string | null = null;

// A tela de plano pode montar no mesmo commit do layout, cujo efeito roda depois
// do dela: quem vai usar o SDK chama isto antes.
export async function ensurePurchases(userId: string): Promise<void> {
  const apiKey = environment.config.revenuecatKey;
  if (!apiKey) throw new Error("purchases_not_configured");
  if (purchasesUserId === null && !(await Purchases.isConfigured())) {
    if (purchasesUserId !== null) return ensurePurchases(userId);
    purchasesUserId = userId;
    Purchases.configure({ apiKey, appUserID: userId });
    return;
  }
  if (purchasesUserId === userId) return;
  purchasesUserId = userId;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    purchasesUserId = null;
    throw error;
  }
}

async function assertConfigured(): Promise<void> {
  if (!(await Purchases.isConfigured()))
    throw new Error("purchases_not_configured");
}

export async function hasActiveEntitlement(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return ENTITLEMENT in info.entitlements.active;
}

function toPlanPackage(pkg: PurchasesPackage | undefined): TPlanPackage | null {
  if (!pkg) return null;
  const { product } = pkg;
  // com teste grátis a opção padrão começa na fase de R$ 0: o preço é o da fase cheia
  const option = product.defaultOption;
  const fullPrice = option?.fullPricePhase?.price;
  const freePeriod = option?.freePhase?.billingPeriod;
  return {
    price: fullPrice?.formatted ?? product.priceString,
    priceMicros: fullPrice?.amountMicros ?? Math.round(product.price * 1e6),
    hasFreeTrial: Boolean(freePeriod),
    trialDays: freePeriod ? trialDays(freePeriod) : null,
  };
}

async function findPackage(
  plan: keyof typeof PACKAGE_ID
): Promise<PurchasesPackage | undefined> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages.find(
    (p) => p.identifier === PACKAGE_ID[plan]
  );
}

export async function getOffer(): Promise<TPlanOffer | null> {
  await assertConfigured();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages;
  if (!packages) return null;
  const find = (id: string) => packages.find((p) => p.identifier === id);
  return {
    monthly: toPlanPackage(find(PACKAGE_ID.monthly)),
    annual: toPlanPackage(find(PACKAGE_ID.annual)),
  };
}

export async function purchase(
  plan: "monthly" | "annual"
): Promise<"purchased" | "cancelled"> {
  await assertConfigured();
  const pkg = await findPackage(plan);
  if (!pkg) throw new Error("plan_package_not_found");
  try {
    await Purchases.purchasePackage(pkg);
    return "purchased";
  } catch (error) {
    const { code } = error as PurchasesError;
    if (code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
      return "cancelled";
    // a loja já tem a assinatura: segue para a ativação, que o servidor confere
    if (code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR)
      return "purchased";
    throw error;
  }
}

export async function restore(): Promise<boolean> {
  await assertConfigured();
  const info = await Purchases.restorePurchases();
  return ENTITLEMENT in info.entitlements.active;
}
