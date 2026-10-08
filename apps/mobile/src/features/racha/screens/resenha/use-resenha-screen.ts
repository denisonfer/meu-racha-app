import {
  cardsSummary,
  formatResenhaCivilDate,
  leaders,
  namesLine,
  topTeams,
  type TResenha,
} from "@meu-racha/domain";
import { useLocalSearchParams } from "expo-router";
import { useEventResenha } from "../../hooks/use-event-resenha";
import { memberCardProps } from "../../utils/member-card";
import {
  resenhaAssistUnit,
  resenhaGoalUnit,
  resenhaMatchCount,
  resenhaOfMatches,
  RESENHA_RED,
  RESENHA_YELLOW,
  resenhaTeamName,
  resenhaWinUnit,
  SORT_LOAD_FAILED_TEXT,
} from "../../utils/racha-messages";
import type { TResenhaCardRow } from "./resenha-card-list";
import type { TResenhaHighlightsProps } from "./resenha-highlights";
import type { TResenhaPosterProps } from "./resenha-poster";
import { useShareResenha } from "./use-share-resenha";

function toLeader(
  stats: { name: string; value: number }[],
  unitOf: (n: number) => string
) {
  const result = leaders(stats);
  if (!result) return null;
  return {
    names: namesLine(result.names),
    count: result.count,
    unit: unitOf(result.count),
    nameCount: result.names.length,
  };
}

function posterCardsLine(
  yellow: number,
  red: number,
  redNames: string[]
): string {
  const yellowWord = yellow === 1 ? "amarelo" : "amarelos";
  const redWord = red === 1 ? "vermelho" : "vermelhos";
  const names = redNames.length > 0 ? ` · ${redNames.join(", ")}` : "";
  return `${yellow} ${yellowWord} · ${red} ${redWord}${names}`;
}

function posterFromResenha(resenha: TResenha): TResenhaPosterProps {
  const civil = formatResenhaCivilDate(resenha.startsOn);
  const scorers = toLeader(
    resenha.people.map((row) => ({
      name: row.person.displayName,
      value: row.goals,
    })),
    resenhaGoalUnit
  );
  const assists = toLeader(
    resenha.people.map((row) => ({
      name: row.person.displayName,
      value: row.assists,
    })),
    resenhaAssistUnit
  );
  const team = topTeams(resenha.teams);
  const summary = cardsSummary(
    resenha.cards.map((card) => ({
      color: card.color,
      name: card.person.displayName,
    }))
  );

  return {
    rachaName: resenha.rachaName,
    posterDate: `${civil.weekdayShortUpper} ${civil.dayMonth}`,
    shortDate: `${civil.weekdayShort} ${civil.dayMonth}`,
    infoLine: `${resenha.rachaName} · ${resenha.place} · ${resenhaMatchCount(resenha.matchCount)}`,
    scorers,
    scorerCard: resenha.scorerCard
      ? memberCardProps(
          resenha.scorerCard,
          resenha.scorerCard.isSuperStar,
          resenha.scorerCard,
          resenha.rachaName
        )
      : null,
    topTeam: team
      ? {
          names: namesLine(team.teamNumbers.map(resenhaTeamName)).toUpperCase(),
          winsLine: `${team.wins} ${resenhaWinUnit(team.wins).toUpperCase()}`,
          ofMatches: resenhaOfMatches(resenha.matchCount),
        }
      : null,
    assists,
    cards: resenha.cards.map((card) => ({
      color: card.color,
      text: `${card.color === "yellow" ? RESENHA_YELLOW : RESENHA_RED} · ${card.person.displayName} (P${card.matchNumber})`,
    })),
    cardsSummary:
      resenha.cards.length > 4
        ? posterCardsLine(summary.yellow, summary.red, summary.redNames)
        : null,
  };
}

function highlightsFromResenha(resenha: TResenha): TResenhaHighlightsProps {
  const team = topTeams(resenha.teams);
  return {
    scorers: toLeader(
      resenha.people.map((row) => ({
        name: row.person.displayName,
        value: row.goals,
      })),
      resenhaGoalUnit
    ),
    topTeam: team
      ? {
          names: namesLine(team.teamNumbers.map(resenhaTeamName)),
          wins: team.wins,
          unit: resenhaWinUnit(team.wins),
          ofMatches: resenhaOfMatches(resenha.matchCount),
        }
      : null,
    assists: toLeader(
      resenha.people.map((row) => ({
        name: row.person.displayName,
        value: row.assists,
      })),
      resenhaAssistUnit
    ),
  };
}

function cardRowsFromResenha(resenha: TResenha): TResenhaCardRow[] {
  return resenha.cards.map((card, index) => ({
    key: `${card.person.personId}-${card.matchNumber}-${index}`,
    color: card.color,
    name: card.person.displayName,
    matchNumber: card.matchNumber,
  }));
}

export function useResenhaScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const query = useEventResenha(id, eventId);
  const { posterRef, share, isGenerating } = useShareResenha();
  const resenha = query.data ?? null;
  const civil = resenha ? formatResenhaCivilDate(resenha.startsOn) : null;

  return {
    isLoading: query.isPending,
    loadErrorText: query.isError ? SORT_LOAD_FAILED_TEXT : null,
    isRetrying: query.isRefetching,
    retry: () => {
      void query.refetch();
    },
    isEmpty: Boolean(resenha && resenha.matchCount === 0),
    header:
      resenha && civil
        ? {
            weekday: civil.weekdayLong,
            dayMonth: civil.dayMonth,
            placeLine:
              resenha.matchCount === 0
                ? resenha.place
                : `${resenha.place} · ${resenhaMatchCount(resenha.matchCount)}`,
          }
        : null,
    highlights: resenha ? highlightsFromResenha(resenha) : null,
    cards: resenha ? cardRowsFromResenha(resenha) : [],
    poster: resenha ? posterFromResenha(resenha) : null,
    posterRef,
    isGenerating,
    onShare: () => {
      void share(resenha?.scorerCard?.photoUrl ?? null);
    },
  };
}
