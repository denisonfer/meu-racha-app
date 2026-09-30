import { canLeaveRacha, formatRulesSummary } from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useRacha } from "../../hooks/use-racha";
import { pendingCountLabel, pendingWord } from "../../utils/racha-labels";
import { shareInvite } from "../../utils/share-invite";

export function useRachaHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha, isPending, error, refetch, isRefetching } = useRacha(id);
  const isNoAccess = useLeaveOnNoAccess(error);

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
      // no formulário a idade tem bloco próprio; na home, só o resumo a mostra
      summary:
        racha.minAge === null
          ? formatRulesSummary(racha.rules)
          : [
              ...formatRulesSummary(racha.rules),
              `A partir de ${racha.minAge} anos`,
            ],
    },
    canLeave: racha ? canLeaveRacha(racha.role) : false,
    isLoading: isPending || isNoAccess,
    retry: () => void refetch(),
    isRetrying: isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
    backToRachas: () => router.navigate("/rachas"),
    openRequests: () => router.push(`/racha/${id}/requests`),
    openMembers: () => router.push(`/racha/${id}/members`),
    openSettings: () => router.push(`/racha/${id}/settings`),
    openLeave: () => router.push(`/racha/${id}/leave`),
  };
}
