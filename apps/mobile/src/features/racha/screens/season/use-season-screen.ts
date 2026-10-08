import {
  formatResenhaCivilDate,
  initialsOf,
  rankRows,
  seasonLabel,
  type TSeasonList,
  type TSeasonRankingMember,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useSession } from "@/features/auth";
import { useSeasonEvents } from "../../hooks/use-season-events";
import { useSeasonRanking } from "../../hooks/use-season-ranking";
import {
  resenhaAssistUnit,
  resenhaGoalUnit,
  resenhaSummary,
  resenhaWinUnit,
  SEASON_CAPTION_ASSISTS,
  SEASON_CAPTION_GOALS,
  SEASON_CAPTION_WINS,
  SEASON_EMPTY_ASSISTS,
  SEASON_EMPTY_GOALS,
  SEASON_EMPTY_WINS,
  SEASON_LIST_ASSISTS,
  SEASON_LIST_GOALS,
  SEASON_LIST_WINS,
  seasonEventTitle,
  seasonPosition,
  seasonRowA11y,
} from "../../utils/racha-messages";
import type { TRankingRow } from "./ranking-row";

export type TSeasonTab = "ranking" | "events";

const LIST_META: Record<
  TSeasonList,
  {
    label: string;
    caption: string;
    empty: string;
    unitOf: (n: number) => string;
    valueOf: (member: TSeasonRankingMember) => number;
  }
> = {
  goals: {
    label: SEASON_LIST_GOALS,
    caption: SEASON_CAPTION_GOALS,
    empty: SEASON_EMPTY_GOALS,
    unitOf: resenhaGoalUnit,
    valueOf: (member) => member.goals,
  },
  assists: {
    label: SEASON_LIST_ASSISTS,
    caption: SEASON_CAPTION_ASSISTS,
    empty: SEASON_EMPTY_ASSISTS,
    unitOf: resenhaAssistUnit,
    valueOf: (member) => member.assists,
  },
  wins: {
    label: SEASON_LIST_WINS,
    caption: SEASON_CAPTION_WINS,
    empty: SEASON_EMPTY_WINS,
    unitOf: resenhaWinUnit,
    valueOf: (member) => member.wins,
  },
};

function buildRanking(
  members: TSeasonRankingMember[],
  list: TSeasonList,
  userId: string | null
): { rows: TRankingRow[]; pinned: TRankingRow | null } {
  const meta = LIST_META[list];
  const ranked = rankRows(
    members.map((member) => ({
      id: member.profileId,
      name: member.displayName,
      value: meta.valueOf(member),
    })),
    userId
  );
  const byId = new Map(members.map((member) => [member.profileId, member]));

  const toRow = (
    id: string,
    position: number,
    value: number,
    isMe: boolean,
    accessibilityLabel: string
  ): TRankingRow | null => {
    const member = byId.get(id);
    if (!member) return null;
    return {
      key: id,
      position,
      name: member.displayName,
      initials: initialsOf(member.displayName),
      photoUrl: member.photoUrl,
      overall: member.overall,
      value,
      unit: meta.unitOf(value),
      isMe,
      hasLeft: !member.isActive,
      accessibilityLabel,
    };
  };

  const rows = ranked.rows.flatMap((row) => {
    const member = byId.get(row.id);
    if (!member) return [];
    const value = meta.valueOf(member);
    const built = toRow(
      row.id,
      row.position,
      value,
      row.isMe,
      seasonRowA11y(
        row.position,
        member.displayName,
        row.isMe,
        !member.isActive,
        `${value} ${meta.unitOf(value)}`
      )
    );
    return built ? [built] : [];
  });

  const pinned =
    ranked.me && userId
      ? toRow(
          userId,
          ranked.me.position,
          ranked.me.value,
          true,
          `${seasonPosition(ranked.me.position)}, você, ${ranked.me.value} ${meta.unitOf(ranked.me.value)}`
        )
      : null;

  return { rows, pinned };
}

export function useSeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const rankingQuery = useSeasonRanking(id);
  const eventsQuery = useSeasonEvents(id);
  const [tab, setTab] = useState<TSeasonTab>("ranking");
  const [list, setList] = useState<TSeasonList>("goals");

  const members = rankingQuery.data?.members ?? [];
  const meta = LIST_META[list];
  const ranking = rankingQuery.data
    ? buildRanking(members, list, userId)
    : { rows: [] as TRankingRow[], pinned: null };

  const rankingStatus = rankingQuery.isPending
    ? "loading"
    : rankingQuery.isError && rankingQuery.data === undefined
      ? "error"
      : ranking.rows.length === 0
        ? "empty"
        : "ready";

  const eventsStatus = eventsQuery.isPending
    ? "loading"
    : eventsQuery.isError && eventsQuery.data === undefined
      ? "error"
      : (eventsQuery.data?.length ?? 0) === 0
        ? "empty"
        : "ready";

  const eventCards = (eventsQuery.data ?? []).map((event) => {
    const civil = formatResenhaCivilDate(event.startsOn);
    return {
      eventId: event.eventId,
      title: seasonEventTitle(
        `${civil.weekdayShort} ${civil.dayMonth}`,
        event.place
      ),
      summary: resenhaSummary(event.matchCount, event.scorers, event.topGoals),
      isMuted: event.matchCount === 0,
      onOpen: () => router.push(`/racha/${id}/event/${event.eventId}/resenha`),
    };
  });

  const year = rankingQuery.data?.seasonYear;

  return {
    title: year != null ? seasonLabel(year) : "",
    tab,
    onChangeTab: (value: TSeasonTab) => setTab(value),
    list,
    onChangeList: (value: TSeasonList) => setList(value),
    listOptions: [
      { value: "goals" as const, label: LIST_META.goals.label },
      { value: "assists" as const, label: LIST_META.assists.label },
      { value: "wins" as const, label: LIST_META.wins.label },
    ],
    rankingCaption: meta.caption,
    rankingEmptyTitle: meta.empty,
    rankingRows: ranking.rows,
    pinnedRow: ranking.pinned,
    rankingStatus,
    rankingRetry: () => {
      void rankingQuery.refetch();
    },
    rankingRetrying: rankingQuery.isRefetching,
    eventCards,
    eventsStatus,
    eventsRetry: () => {
      void eventsQuery.refetch();
    },
    eventsRetrying: eventsQuery.isRefetching,
  };
}
