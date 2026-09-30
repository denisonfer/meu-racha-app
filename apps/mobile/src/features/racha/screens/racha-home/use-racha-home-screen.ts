import { formatRulesSummary } from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useRacha } from "../../hooks/use-racha";
import { pendingCountLabel, pendingWord } from "../../utils/racha-labels";
import { shareInvite } from "../../utils/share-invite";

export function useRachaHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha, isPending, refetch, isRefetching } = useRacha(id);

  const isOwnerOrAdmin = racha
    ? racha.role === "OWNER" || racha.role === "ADMIN"
    : false;
  const pendingRow =
    racha && isOwnerOrAdmin && racha.pendingCount > 0
      ? {
          count: racha.pendingCount,
          word: pendingWord(racha.pendingCount),
          label: pendingCountLabel(racha.pendingCount),
        }
      : null;

  return {
    racha: racha && {
      name: racha.name,
      role: racha.role,
      inviteCode: racha.inviteCode,
      isOwner: racha.role === "OWNER",
      memberCount: racha.memberCount,
      pendingRow,
      summary: formatRulesSummary(racha.rules),
    },
    isLoading: isPending,
    retry: () => void refetch(),
    isRetrying: isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
    backToRachas: () => router.navigate("/rachas"),
    openRequests: () => router.push(`/racha/${id}/requests`),
    openMembers: () => router.push(`/racha/${id}/members`),
  };
}
