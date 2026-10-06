import type { TLastBolinhas } from "@meu-racha/domain";
import type { TSortTeamsProps } from "../../components/sort-teams";
import type { TSortTeamCardPerson } from "../../components/sort-team-card";
import { bolinhasCameFrom } from "../../utils/racha-messages";

/** A1: quem veio pelas Bolinhas fica em destaque, com a origem na linha de detalhe. */
export function highlightMoved(
  teams: TSortTeamsProps["teams"],
  last: TLastBolinhas | null
): TSortTeamsProps["teams"] {
  if (!last) return teams;
  const moved = new Map(
    last.moved.map((person) => [
      person.profileId ?? person.guestId ?? "",
      person.fromTeamNumber,
    ])
  );
  const mark = (person: TSortTeamCardPerson): TSortTeamCardPerson => {
    const from = moved.get(person.key);
    return from === undefined
      ? person
      : { ...person, isHighlighted: true, detail: bolinhasCameFrom(from) };
  };
  return teams.map((team) =>
    team.key === `team:${last.receiverTeamNumber}`
      ? {
          ...team,
          players: team.players.map(mark),
          playerGroups:
            team.playerGroups?.map((group) => ({
              ...group,
              players: group.players.map(mark),
            })) ?? null,
        }
      : team
  );
}
