import {
  OVERALL_MIN,
  roleBadge,
  seasonLabel,
  type TMemberCard,
  type TMemberCardStats,
} from "@meu-racha/domain";
import {
  keeperStats,
  lineStats,
} from "@/ui/components/player-card/player-card-stats";
import { TRachaMember } from "../racha-types";

const ZERO_LINE = { wins: 0, goals: 0, assists: 0, games: 0 };
const ZERO_KEEPER = { wins: 0, cleanSheets: 0, goals: 0, games: 0 };

/** Avulso e quem ainda não tem carta no mapa ficam no piso. O número não se recalcula aqui. */
export function cardOverall(
  cards: ReadonlyMap<string, TMemberCard> | undefined,
  profileId: string | null
): number {
  if (profileId == null || cards == null) return OVERALL_MIN;
  return cards.get(profileId)?.overall ?? OVERALL_MIN;
}

/**
 * Carta do Membro. O Overall vem pronto do banco.
 * Sem card, fica o de entrada: 40 e números zerados.
 */
export const memberCardProps = (
  member: Pick<
    TRachaMember,
    "displayName" | "photoUrl" | "playsAs" | "primaryPosition"
  >,
  isSuperStar: boolean,
  card?: TMemberCardStats | null,
  rachaName?: string | null
) => {
  const shownKeeper = card
    ? card.shownRole === "GOALKEEPER"
    : member.playsAs === "GOALKEEPER";

  return {
    overall: card?.overall ?? OVERALL_MIN,
    name: member.displayName,
    photoUri: member.photoUrl,
    // Com carta, a sigla segue o papel mostrado. Linha usa a posição
    // daquele Racha: Onde joga de goleiro não vira GOL. Sem carta, o Onde joga.
    badge: !card
      ? roleBadge(member.playsAs, member.primaryPosition)
      : card.shownRole === "GOALKEEPER"
        ? roleBadge("GOALKEEPER", null)
        : roleBadge("OUTFIELD", card.primaryPosition),
    stats: shownKeeper
      ? keeperStats(
          card
            ? {
                wins: card.keeper.wins,
                cleanSheets: card.keeper.cleanSheets,
                goals: card.keeper.goals,
                games: card.keeper.matches,
              }
            : ZERO_KEEPER
        )
      : lineStats(
          card
            ? {
                wins: card.line.wins,
                goals: card.line.goals,
                assists: card.line.assists,
                games: card.line.matches,
              }
            : ZERO_LINE
        ),
    context:
      card && rachaName
        ? `${rachaName} · ${seasonLabel(card.seasonYear)}`
        : "Overall de entrada",
    isSuperStar,
  };
};
