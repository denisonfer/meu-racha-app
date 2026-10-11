import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Linking } from "react-native";
import {
  pushEnabledKey,
  requestPushPermission,
  setPushEnabled,
  usePushEnabled,
  usePushPermission,
} from "@/features/notification";
import { openWebPage } from "@/lib/open-web-page";
import { useToast } from "@/ui/components";
import { pushBanner } from "./push-banner";
import { pushEnabledOptions } from "./push-enabled-options";

export function useSettingsScreen() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const pushEnabled = usePushEnabled();
  const { permission, refresh } = usePushPermission();
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

  return {
    pushEnabled: pushEnabled === true,
    isPushLoading: pushEnabled === undefined,
    togglePush: (enabled: boolean) => void toggle(enabled),
    banner: pushBanner(pushEnabled, permission),
    openSettings: () => void Linking.openSettings(),
    askPermission: () => void askPermission(),
    openTerms: () => openWebPage("/termos"),
    openPrivacy: () => openWebPage("/privacidade"),
    version: Constants.expoConfig?.version ?? "",
  };
}
