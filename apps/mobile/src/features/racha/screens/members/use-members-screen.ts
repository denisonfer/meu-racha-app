import { formatPlaysAs, groupMembersByPosition } from "@meu-racha/domain";
import { useLocalSearchParams } from "expo-router";
import { useSession } from "@/features/auth";
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

function accessibilityLabelFor(member: TRachaMember, isMe: boolean): string {
  const parts = [isMe ? `${member.displayName} (você)` : member.displayName];
  if (member.role !== "PLAYER")
    parts.push(ROLE_ACCESSIBILITY_LABEL[member.role]);
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

  const members = membersQuery.data ?? [];
  const groups = groupMembersByPosition(members).map((group) => ({
    key: group.key,
    label: group.label,
    members: group.members.map((member) => {
      const isMe = member.profileId === session?.userId;
      return {
        profileId: member.profileId,
        name: member.displayName,
        photoUrl: member.photoUrl,
        isMe,
        role: member.role,
        isGoalkeeper: member.playsAs === "GOALKEEPER",
        positionText: formatPosition(member),
        stars: member.stars,
        isSuperStar: member.isSuperStar,
        accessibilityLabel: accessibilityLabelFor(member, isMe),
      };
    }),
  }));

  return {
    count: members.length,
    memberWord: members.length === 1 ? "membro" : "membros",
    showGroupTitles: members.length > 1,
    groups,
    isOnlyOwner: members.length === 1,
    isLoading: membersQuery.isPending,
    isError: membersQuery.isError,
    retry: () => void membersQuery.refetch(),
    isRetrying: membersQuery.isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
  };
}
