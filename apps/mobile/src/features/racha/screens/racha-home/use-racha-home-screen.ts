import { formatRulesSummary } from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { Share } from "react-native";
import { useRacha } from "../../hooks/use-racha";
import { memberCountLabel } from "../../utils/racha-labels";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://meuracha.app";

export function useRachaHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha, isPending, refetch, isRefetching } = useRacha(id);

  const shareInvite = () => {
    if (!racha) return;
    void Share.share({
      message: `Entra no ${racha.name} no Meu Racha: ${WEB_URL}/r/${racha.inviteCode}\nCódigo do racha: ${racha.inviteCode}`,
    });
  };

  return {
    racha: racha && {
      name: racha.name,
      inviteCode: racha.inviteCode,
      isOwner: racha.role === "OWNER",
      membersLabel:
        racha.memberCount === 1
          ? "Você · 1 membro"
          : memberCountLabel(racha.memberCount),
      summary: formatRulesSummary(racha.rules),
    },
    isLoading: isPending,
    retry: () => void refetch(),
    isRetrying: isRefetching,
    shareInvite,
    backToRachas: () => router.navigate("/rachas"),
  };
}
