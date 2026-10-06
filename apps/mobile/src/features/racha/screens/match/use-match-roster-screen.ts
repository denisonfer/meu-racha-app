import {
  matchElapsedSeconds,
  runningYellows,
  serverOffsetMs,
  yellowOutSeconds,
  yellowRemaining,
  OVERALL_MIN,
  type TMatchPerson,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import type { TSortRowAction } from "../../components/sort-team-card";
import type { TSortPersonListRow } from "../../components/sort-person-list";
import { useEventMatch } from "../../hooks/use-event-match";
import {
  MATCH_CARD,
  MATCH_CARD_EXPELLED_ROW,
  MATCH_GOL_DETAIL,
  MATCH_SWAP_KEEPER,
  SORT_LEAVE_OTHER,
  matchCardFor,
  matchCardYellowRow,
  matchRosterOnField,
  matchRosterTitle,
  sortLeaveOtherLabel,
  sortTeamTitle,
} from "../../utils/racha-messages";
import { formatClock } from "./match-format";

function personQuery(profileId: string | null, guestId: string | null) {
  return profileId ? `profileId=${profileId}` : `guestId=${guestId}`;
}

export function useMatchRosterScreen() {
  const { id, eventId, teamId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    teamId?: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const portrait = matchQuery.data;
  const match = portrait?.match ?? null;
  const side =
    match && teamId
      ? match.home.teamId === teamId
        ? match.home
        : match.away.teamId === teamId
          ? match.away
          : null
      : null;

  const offset = portrait
    ? serverOffsetMs(portrait.serverNow, matchQuery.dataUpdatedAt)
    : 0;
  const elapsed = portrait
    ? matchElapsedSeconds(
        {
          startedAt: portrait.startedAt,
          pausedAt: portrait.pausedAt,
          pausedSeconds: portrait.pausedSeconds,
        },
        nowMs + offset
      )
    : 0;
  const cards = match?.cards ?? [];
  const isMark = portrait?.yellowCardMode === "mark";
  const outSeconds = portrait
    ? yellowOutSeconds(portrait.yellowCardMode, portrait.yellowOutMin)
    : 0;
  const running = runningYellows(cards, elapsed, outSeconds);
  const runningIds = new Set(running.map((card) => card.person.personId));
  // Advertência: marcada de amarelo, mas em campo (quem foi expulso nem está no elenco ativo)
  const markedIds = new Set(
    isMark
      ? cards
          .filter((card) => card.color === "yellow")
          .map((card) => card.person.personId)
      : []
  );

  const openCard = (person: TMatchPerson) => {
    router.push(
      `/racha/${id}/event/${eventId}/match-card?teamId=${teamId}&${personQuery(person.profileId, person.guestId)}&name=${encodeURIComponent(person.displayName)}`
    );
  };

  const cardAction = (person: TMatchPerson): TSortRowAction => ({
    label: MATCH_CARD,
    icon: "cartao",
    caption: MATCH_CARD,
    accessibilityLabel: matchCardFor(person.displayName),
    isDisabled: false,
    onPress: () => openCard(person),
  });

  const yellowDetail = (personId: string, isKeeper: boolean) => {
    if (markedIds.has(personId)) return matchCardYellowRow(null, isKeeper);
    const card = running.find((item) => item.person.personId === personId);
    if (!card) return null;
    return matchCardYellowRow(
      formatClock(yellowRemaining(card, elapsed, outSeconds)),
      isKeeper
    );
  };

  const keeperRows: TSortPersonListRow[] = [];
  const lineRows: TSortPersonListRow[] = [];
  const expelledKeeperRows: TSortPersonListRow[] = [];
  const expelledLineRows: TSortPersonListRow[] = [];
  const keeper = side?.goalkeeper ?? null;
  if (side && keeper) {
    const detail = yellowDetail(keeper.personId, true) ?? MATCH_GOL_DETAIL;
    const onYellow =
      runningIds.has(keeper.personId) || markedIds.has(keeper.personId);
    keeperRows.push({
      key: `gk:${keeper.personId}`,
      name: keeper.displayName,
      photoUrl: keeper.photoUrl,
      overall: OVERALL_MIN,
      detail,
      accessibilityLabel: `${keeper.displayName}, ${detail}`,
      isSelected: false,
      onPress: null,
      statusMark: onYellow ? "yellow" : null,
      actions: [
        cardAction(keeper),
        {
          label: MATCH_SWAP_KEEPER,
          accessibilityLabel: MATCH_SWAP_KEEPER,
          isDisabled: false,
          onPress: () =>
            router.push(
              `/racha/${id}/event/${eventId}/match-goalkeeper?teamId=${teamId}`
            ),
        },
      ],
    });
  }

  for (const entry of side?.lineup ?? []) {
    if (entry.leftAt != null) continue;
    const onYellow =
      runningIds.has(entry.person.personId) ||
      markedIds.has(entry.person.personId);
    const detail = yellowDetail(entry.person.personId, false) ?? "";
    lineRows.push({
      key: entry.person.personId,
      name: entry.person.displayName,
      photoUrl: entry.person.photoUrl,
      overall: OVERALL_MIN,
      detail,
      accessibilityLabel: detail
        ? `${entry.person.displayName}, ${detail}`
        : entry.person.displayName,
      isSelected: false,
      onPress: null,
      statusMark: onYellow ? "yellow" : null,
      actions: [
        cardAction(entry.person),
        {
          label: SORT_LEAVE_OTHER,
          accessibilityLabel: sortLeaveOtherLabel(entry.person.displayName),
          isDisabled: false,
          onPress: () =>
            router.push(
              `/racha/${id}/event/${eventId}/match-leave?teamId=${teamId}&${personQuery(entry.person.profileId, entry.person.guestId)}&name=${encodeURIComponent(entry.person.displayName)}`
            ),
        },
      ],
    });
  }

  const activeIds = new Set<string>([
    ...(keeper ? [keeper.personId] : []),
    ...(side?.lineup ?? []).map((entry) => entry.person.personId),
  ]);
  for (const entry of match?.lineup ?? []) {
    if (!side || entry.teamId !== side.teamId || !entry.leftByRed) continue;
    if (activeIds.has(entry.person.personId)) continue;
    const row: TSortPersonListRow = {
      key: `red:${entry.role}:${entry.person.personId}`,
      name: entry.person.displayName,
      photoUrl: entry.person.photoUrl,
      overall: OVERALL_MIN,
      detail: MATCH_CARD_EXPELLED_ROW,
      accessibilityLabel: `${entry.person.displayName}, ${MATCH_CARD_EXPELLED_ROW}`,
      isSelected: false,
      onPress: null,
      isDimmed: true,
      statusMark: "red",
      actions: [],
    };
    if (entry.role === "GOALKEEPER") expelledKeeperRows.push(row);
    else expelledLineRows.push(row);
  }

  const rows = [
    ...keeperRows,
    ...expelledKeeperRows,
    ...lineRows,
    ...expelledLineRows,
  ];

  const line = (side?.lineup ?? []).filter(
    (entry) => entry.leftAt == null && !runningIds.has(entry.person.personId)
  ).length;
  const keeperIn = keeper != null && !runningIds.has(keeper.personId);

  return {
    isMissing: !match || !teamId || side == null,
    title: side ? matchRosterTitle(sortTeamTitle(side.teamNumber)) : "",
    listTitle: side ? matchRosterOnField(line, keeperIn) : "",
    rows,
  };
}
