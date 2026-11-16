import { getPlanStatus, type TMyPlan } from "@meu-racha/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking } from "react-native";
import { useBlockedProfiles } from "@/features/moderation";
import {
  pushEnabledKey,
  requestPushPermission,
  setPushEnabled,
  usePushEnabled,
  usePushPermission,
} from "@/features/notification";
import { planDate, purchaseAvailable, useMyPlan } from "@/features/plan";
import { openWebPage } from "@/lib/open-web-page";
import { useToast } from "@/ui/components";
import {
  CONTACT_COPIED,
  CONTACT_EMAIL,
  PRO_ROW_ACTIVE,
  PRO_ROW_BILLING,
  PRO_ROW_FREE,
  PRO_ROW_SOON,
  proRowEnds,
  proRowTrial,
} from "../../utils/settings-messages";
import { pushBanner } from "./push-banner";
import { pushEnabledOptions } from "./push-enabled-options";

function proSummary(plan: TMyPlan | undefined) {
  if (!plan) return null;
  const status = getPlanStatus(plan, new Date());
  switch (status.kind) {
    case "free":
      return { text: purchaseAvailable() ? PRO_ROW_FREE : PRO_ROW_SOON };
    case "trial":
      return { text: proRowTrial(planDate(status.until)) };
    case "renewing":
      return { text: PRO_ROW_ACTIVE };
    case "ending":
      return { text: proRowEnds(planDate(status.until)) };
    case "billing_issue":
      return { text: PRO_ROW_BILLING, isWarning: true };
  }
}

export function useSettingsScreen() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const pushEnabled = usePushEnabled();
  const { permission, refresh } = usePushPermission();
  const blockedQuery = useBlockedProfiles();
  const planQuery = useMyPlan();
  const mutation = useMutation(
    pushEnabledOptions(queryClient, pushEnabledKey, setPushEnabled, (message) =>
      showToast(message, "danger")
    )
  );

  // concedida, o refresh registra o token ao ver a permissão virar
  const askPermission = async () => {
    await requestPushPermission();
    await refresh();
  };

  // Ligar grava true qualquer que seja a resposta: a escolha vale para os
  // outros aparelhos da conta.
  const toggle = async (enabled: boolean) => {
    if (
      enabled &&
      permission &&
      !permission.granted &&
      permission.canAskAgain
    ) {
      await askPermission();
    }
    mutation.mutate(enabled);
  };

  // sem app de e-mail o openURL rejeita: o endereço vai para a área de transferência
  const contactUs = async () => {
    try {
      await Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Meu%20Racha`);
    } catch {
      await Clipboard.setStringAsync(CONTACT_EMAIL);
      showToast(CONTACT_COPIED, "success");
    }
  };

  return {
    pushEnabled: pushEnabled === true,
    isPushLoading: pushEnabled === undefined,
    togglePush: (enabled: boolean) => void toggle(enabled),
    banner: pushBanner(pushEnabled, permission),
    openSettings: () => void Linking.openSettings(),
    askPermission: () => void askPermission(),
    openTerms: () => openWebPage("/termos"),
    openPrivacy: () => openWebPage("/privacidade"),
    openDeleteAccount: () => router.push("/settings/delete-account"),
    blockedCount: blockedQuery.data?.length ?? 0,
    openBlockedPeople: () => router.push("/settings/blocked-people"),
    contactUs: () => void contactUs(),
    proSummary: proSummary(planQuery.data),
    openPro: () => router.push("/settings/pro"),
    version: Constants.expoConfig?.version ?? "",
  };
}
