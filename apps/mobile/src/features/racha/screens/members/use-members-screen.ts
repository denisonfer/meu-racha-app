import {
  formatPlaysAs,
  groupMembersByPosition,
  initialsOf,
  LEVEL_NAME,
  levelFromOverall,
  OVERALL_MIN,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "@/features/auth";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useRacha } from "../../hooks/use-racha";
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

// o Overall nasce das partidas (fatia 5); até lá todo mundo é Cria da Base
const MEMBER_OVERALL = OVERALL_MIN;

function accessibilityLabelFor(member: TRachaMember, isMe: boolean): string {
  const overall = MEMBER_OVERALL;
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
  const { data: racha } = useRacha(id);
  const isNoAccess = useLeaveOnNoAccess(
    membersQuery.error,
    membersQuery.fetchStatus,
    id
  );

  const members = membersQuery.data ?? [];
  const groups = groupMembersByPosition(members).map((group) => ({
    key: group.key,
    label: group.label,
    members: group.members.map((member) => {
      const isMe = member.profileId === session?.userId;
      return {
        profileId: member.profileId,
        name: member.displayName,
        initials: initialsOf(member.displayName),
        photoUrl: member.photoUrl,
        overall: MEMBER_OVERALL,
        isMe,
        role: member.role,
        isGoalkeeper: member.playsAs === "GOALKEEPER",
        positionText: formatPosition(member),
        stars: member.stars,
        isSuperStar: member.isSuperStar,
        accessibilityLabel: accessibilityLabelFor(member, isMe),
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
    isLoading: membersQuery.isPending || isNoAccess,
    isError: membersQuery.isError && !isNoAccess,
    retry: () => void membersQuery.refetch(),
    isRetrying: membersQuery.isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
  };
}
