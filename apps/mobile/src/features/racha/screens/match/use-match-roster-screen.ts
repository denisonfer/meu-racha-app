import { OVERALL_MIN } from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import type { TSortPersonListRow } from "../../components/sort-person-list";
import { useEventMatch } from "../../hooks/use-event-match";
import {
  MATCH_GOL_DETAIL,
  MATCH_SWAP_KEEPER,
  SORT_LEAVE_OTHER,
  matchLinePlayers,
  matchRosterTitle,
  sortLeaveOtherLabel,
  sortTeamTitle,
} from "../../utils/racha-messages";

export function useMatchRosterScreen() {
  const { id, eventId, teamId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    teamId?: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const match = matchQuery.data?.match ?? null;
  const side =
    match && teamId
      ? match.home.teamId === teamId
        ? match.home
        : match.away.teamId === teamId
          ? match.away
          : null
      : null;

  const personQuery = (profileId: string | null, guestId: string | null) =>
    profileId ? `profileId=${profileId}` : `guestId=${guestId}`;

  const keeper = side?.goalkeeper;
  const rows: TSortPersonListRow[] = [];
  if (side && keeper) {
    rows.push({
      key: `gk:${keeper.personId}`,
      name: keeper.displayName,
      photoUrl: keeper.photoUrl,
      overall: OVERALL_MIN,
      detail: MATCH_GOL_DETAIL,
      accessibilityLabel: `${keeper.displayName}, ${MATCH_GOL_DETAIL}`,
      isSelected: false,
      onPress: null,
      action: {
        label: MATCH_SWAP_KEEPER,
        accessibilityLabel: MATCH_SWAP_KEEPER,
        isDisabled: false,
        onPress: () =>
          router.push(
            `/racha/${id}/event/${eventId}/match-goalkeeper?teamId=${teamId}`
          ),
      },
    });
  }
  for (const entry of side?.lineup ?? []) {
    rows.push({
      key: entry.person.personId,
      name: entry.person.displayName,
      photoUrl: entry.person.photoUrl,
      overall: OVERALL_MIN,
      detail: "",
      accessibilityLabel: entry.person.displayName,
      isSelected: false,
      onPress: null,
      action: {
        label: SORT_LEAVE_OTHER,
        accessibilityLabel: sortLeaveOtherLabel(entry.person.displayName),
        isDisabled: false,
        onPress: () =>
          router.push(
            `/racha/${id}/event/${eventId}/match-leave?teamId=${teamId}&${personQuery(entry.person.profileId, entry.person.guestId)}&name=${encodeURIComponent(entry.person.displayName)}`
          ),
      },
    });
  }

  return {
    isMissing: !match || !teamId || side == null,
    title: side ? matchRosterTitle(sortTeamTitle(side.teamNumber)) : "",
    listTitle: side ? matchLinePlayers(side.outfieldCount, side.capacity) : "",
    rows,
  };
}
