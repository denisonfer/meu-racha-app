import {
  formatPlaysAs,
  groupMembersByPosition,
  initialsOf,
  LEVEL_NAME,
  levelFromOverall,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "@/features/auth";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useRacha } from "../../hooks/use-racha";
import { cardOverall, useRachaCards } from "../../hooks/use-racha-cards";
import { useRachaMembers } from "../../hooks/use-racha-members";
import { TRachaMember } from "../../racha-types";
import { ROLE_ACCESSIBILITY_LABEL, starsLabel } from "../../utils/racha-labels";
import { shareInvite } from "../../utils/share-invite";

const formatPosition = (member: TRachaMember) =>
  formatPlaysAs(
    member.playsAs,
    member.primaryPosition,
    member.secondaryPosition
  ).replace(/^Linha · /, "");

function accessibilityLabelFor(
  member: TRachaMember,
  isMe: boolean,
  overall: number
): string {
  const parts = [isMe ? `${member.displayName} (você)` : member.displayName];
  if (member.role !== "PLAYER")
    parts.push(ROLE_ACCESSIBILITY_LABEL[member.role]);
  parts.push(`${LEVEL_NAME[levelFromOverall(overall)]} ${overall}`);
  if (member.playsAs === "GOALKEEPER") {
    parts.push("Gol");
  } else {
    parts.push(formatPosition(member));
    if (member.stars !== null) parts.push(starsLabel(member.stars));
  }
  if (member.isSuperStar) parts.push("Super Estrela");
  return parts.join(", ");
}

export function useMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const membersQuery = useRachaMembers(id);
  const cardsQuery = useRachaCards(id);
  const { data: racha } = useRacha(id);
  const isNoAccess = useLeaveOnNoAccess(
    membersQuery.error,
    membersQuery.fetchStatus,
    id
  );

  const members = membersQuery.data ?? [];
  const cards = cardsQuery.data;
  const groups = groupMembersByPosition(members).map((group) => ({
    key: group.key,
    label: group.label,
    members: group.members.map((member) => {
      const isMe = member.profileId === session?.userId;
      const overall = cardOverall(cards, member.profileId);
      return {
        profileId: member.profileId,
        name: member.displayName,
        initials: initialsOf(member.displayName),
        photoUrl: member.photoUrl,
        overall,
        isMe,
        role: member.role,
        isGoalkeeper: member.playsAs === "GOALKEEPER",
        positionText: formatPosition(member),
        stars: member.stars,
        isSuperStar: member.isSuperStar,
        accessibilityLabel: accessibilityLabelFor(member, isMe, overall),
        onPress: () => router.push(`/racha/${id}/member/${member.profileId}`),
      };
    }),
  }));

  return {
    count: members.length,
    memberWord: members.length === 1 ? "membro" : "membros",
    showGroupTitles: members.length > 1,
    groups,
    isOnlyOwner: members.length === 1,
    isLoading: membersQuery.isPending || cardsQuery.isLoading || isNoAccess,
    // Sem a carta, o piso 40 parece Overall de verdade.
    isError: (membersQuery.isError || cardsQuery.isError) && !isNoAccess,
    retry: () => {
      void membersQuery.refetch();
      void cardsQuery.refetch();
    },
    isRetrying: membersQuery.isRefetching || cardsQuery.isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
  };
}
