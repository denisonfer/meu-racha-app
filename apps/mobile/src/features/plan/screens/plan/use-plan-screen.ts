import { getPlanStatus, type TMyPlan } from "@meu-racha/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useState } from "react";
import { Linking, Platform } from "react-native";
import { useSession } from "@/features/auth";
import { openWebPage } from "@/lib/open-web-page";
import { useToast } from "@/ui/components";
import { planKey, useMyPlan } from "../../hooks/use-my-plan";
import {
  ensurePurchases,
  getOffer,
  purchase,
  purchaseAvailable,
  restore,
  syncMyPlan,
} from "../../plan-api";
import type { TPlanOffer } from "../../plan-types";
import { playSubscriptionsUrl } from "../../utils/purchase-availability";
import {
  brlFromMicros,
  PRO_ANNUAL,
  PRO_MONTHLY,
  PRO_REACTIVATE_HINT,
  PRO_RESTORE_FAILED,
  PRO_RESTORE_NONE,
  PRO_SUBSCRIBE,
  planDate,
  proAfterTrial,
  proPerMonth,
  proPerYear,
  proPerYearShort,
  proRenews,
  proSaving,
  proStatusEnds,
  proStatusRenews,
  proStatusTrial,
  proStatusUntil,
  proTrialCta,
} from "../../utils/plan-messages";
import { ACTIVATION_POLL_MS, nextActivation } from "./activation";

export type TPlanChoice = "monthly" | "annual";
export type TOfferPhase =
  "loading" | "unavailable" | "ready" | "activating" | "slow";

function planOptions(offer: TPlanOffer) {
  const { monthly, annual } = offer;
  const options = [];
  if (monthly)
    options.push({
      value: "monthly" as const,
      title: PRO_MONTHLY,
      description: proPerMonth(monthly.price),
    });
  if (annual) {
    const saving = monthly ? monthly.priceMicros * 12 - annual.priceMicros : 0;
    options.push({
      value: "annual" as const,
      title: PRO_ANNUAL,
      description: proPerYear(
        annual.price,
        brlFromMicros(annual.priceMicros / 12)
      ),
      detail: saving > 0 ? proSaving(brlFromMicros(saving)) : undefined,
    });
  }
  return options;
}

function statusTexts(plan: TMyPlan, canUseStore: boolean) {
  const status = getPlanStatus(plan, new Date());
  if (status.kind === "free") return null;
  const date = planDate(status.until);
  switch (status.kind) {
    case "trial":
      return { title: proStatusTrial(date) };
    case "renewing":
      return { title: proStatusRenews(date) };
    case "ending":
      return {
        title: proStatusEnds(date),
        detail: canUseStore ? PRO_REACTIVATE_HINT : undefined,
      };
    case "billing_issue":
      return { title: proStatusUntil(date), hasBillingIssue: canUseStore };
  }
}

export function usePlanScreen() {
  const { session } = useSession();
  const userId = session?.userId ?? "";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const isAvailable = purchaseAvailable();
  // gerenciar a assinatura é na Play mesmo com a venda fechada; no iPhone não se cita loja
  const canUseStore = Platform.OS === "android";

  const planQuery = useMyPlan();
  const plan = planQuery.data;
  const isPro = plan?.isPro === true;

  const offerQuery = useQuery({
    queryKey: ["plan-offer", userId],
    queryFn: async () => {
      await ensurePurchases(userId);
      return getOffer();
    },
    enabled: isAvailable && Boolean(userId) && plan?.isPro === false,
  });

  const [activation, dispatch] = useReducer(nextActivation, { kind: "offer" });
  const [choice, setChoice] = useState<TPlanChoice | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const refreshPlan = () =>
    queryClient.invalidateQueries({ queryKey: planKey(userId) });

  const isActivating = activation.kind === "activating";
  useEffect(() => {
    if (!isActivating || !userId) return;
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: planKey(userId) });
    // sem rede, a sincronização falha calada: os ticks levam a "Demorou"
    syncMyPlan().then(refresh, () => {});
    const timer = setInterval(() => {
      dispatch({ type: "tick", elapsed: ACTIVATION_POLL_MS });
      void refresh();
    }, ACTIVATION_POLL_MS);
    return () => clearInterval(timer);
  }, [isActivating, userId, queryClient]);

  useEffect(() => {
    if (!isPro) return;
    dispatch({ type: "plan_is_pro" });
    // o racha em cache ainda traz o admin_limit do Free (Jornada 6)
    void queryClient.invalidateQueries({ queryKey: ["racha"] });
  }, [isPro, queryClient]);

  const offer = offerQuery.data;
  const options = offer ? planOptions(offer) : [];
  const selected = choice ?? options[0]?.value ?? "monthly";
  const selectedPackage = offer?.[selected] ?? null;
  const trialDays = selectedPackage?.hasFreeTrial
    ? selectedPackage.trialDays
    : null;
  const priceText = selectedPackage
    ? selected === "monthly"
      ? proPerMonth(selectedPackage.price)
      : proPerYearShort(selectedPackage.price)
    : "";

  const phase: TOfferPhase =
    activation.kind === "activating"
      ? "activating"
      : activation.kind === "slow"
        ? "slow"
        : planQuery.isError || offerQuery.isError
          ? "unavailable"
          : !plan || offerQuery.isPending
            ? "loading"
            : options.length === 0
              ? "unavailable"
              : "ready";

  const buy = async () => {
    setIsBuying(true);
    setIsDeclined(false);
    try {
      await ensurePurchases(userId);
      dispatch({ type: await purchase(selected) });
    } catch {
      setIsDeclined(true);
    } finally {
      setIsBuying(false);
    }
  };

  const restorePurchase = async () => {
    setIsRestoring(true);
    try {
      await ensurePurchases(userId);
      if (!(await restore())) showToast(PRO_RESTORE_NONE, "danger");
    } catch {
      showToast(PRO_RESTORE_FAILED, "danger");
    }
    // achando ou não, o servidor confere: a loja pode ter o que o banco ainda não tem
    await syncMyPlan().catch(() => {});
    await refreshPlan();
    setIsRestoring(false);
  };

  const mode = isPro ? "status" : isAvailable ? "offer" : "unavailable";

  return {
    mode,
    isIos: Platform.OS === "ios",
    phase,
    options,
    selected,
    selectPlan: setChoice,
    ctaTitle: trialDays ? proTrialCta(trialDays) : PRO_SUBSCRIBE,
    renewal: trialDays ? proAfterTrial(priceText) : proRenews(priceText),
    isBuying,
    isDeclined,
    buy: () => void buy(),
    retryLoad: () => {
      void planQuery.refetch();
      void offerQuery.refetch();
    },
    retryActivation: () => dispatch({ type: "retry" }),
    status: plan && isPro ? statusTexts(plan, canUseStore) : null,
    canManage: canUseStore,
    manage: () =>
      void Linking.openURL(playSubscriptionsUrl(plan?.productId ?? null)),
    canRestore: isAvailable,
    isRestoring,
    restore: () => void restorePurchase(),
    openTerms: () => openWebPage("/termos"),
    openPrivacy: () => openWebPage("/privacidade"),
  };
}
