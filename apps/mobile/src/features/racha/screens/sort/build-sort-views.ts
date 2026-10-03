import {
  OVERALL_MIN,
  type TSortPerson,
  type TSortPlayer,
  type TSortTeam,
} from "@meu-racha/domain";
import type {
  TSortRowAction,
  TSortTeamCardPerson,
} from "../../components/sort-team-card";
import type { TSortTeamsProps } from "../../components/sort-teams";
import { starsLabel } from "../../utils/racha-labels";
import {
  sortMissingToComplete,
  sortTeamTitle,
} from "../../utils/racha-messages";
import {
  missingToComplete,
  sortPersonId,
  sortPositionText,
} from "../../utils/sort-view";

/** Quem pode agir sobre aquela pessoa; null quando o espectador não tem ação. */
export type TSortLeaveActionFor = (
  person: TSortPerson
) => TSortRowAction | null;

const playerView = (
  player: TSortPlayer,
  leaveActionFor: TSortLeaveActionFor
): TSortTeamCardPerson => {
  const detail = sortPositionText(player);
  return {
    key: sortPersonId(player),
    name: player.displayName,
    photoUrl: player.photoUrl,
    overall: OVERALL_MIN,
    detail,
    stars: player.stars,
    isSuperStar: player.isSuperStar,
    isGoalkeeper: false,
    accessibilityLabel: [
      player.displayName,
      detail,
      starsLabel(player.stars),
      player.isSuperStar ? "Super Estrela" : null,
    ]
      .filter(Boolean)
      .join(", "),
    action: leaveActionFor(player),
  };
};

const goalkeeperView = (
  person: TSortPerson,
  leaveActionFor: TSortLeaveActionFor
): TSortTeamCardPerson => ({
  key: `gk:${sortPersonId(person)}`,
  name: person.displayName,
  photoUrl: person.photoUrl,
  overall: OVERALL_MIN,
  detail: "Goleiro",
  stars: null,
  isSuperStar: false,
  isGoalkeeper: true,
  accessibilityLabel: `${person.displayName}, goleiro`,
  action: leaveActionFor(person),
});

const playersWord = (count: number) =>
  count === 1 ? "1 jogador" : `${count} jogadores`;

/** Cartões de Time: a mesma conta para a proposta e para os Times publicados. */
export function buildTeamCards(
  teams: TSortTeam[],
  outfieldPerTeam: number | null,
  leaveActionFor: TSortLeaveActionFor
): TSortTeamsProps["teams"] {
  return teams.map((team) => {
    const isIncomplete = !team.isComplete;
    const missing = isIncomplete
      ? missingToComplete(outfieldPerTeam, team.playerCount)
      : 0;
    const header = [
      sortTeamTitle(team.teamNumber),
      starsLabel(team.starSum),
      playersWord(team.playerCount),
      isIncomplete ? "incompleto" : null,
      missing > 0 ? sortMissingToComplete(missing) : null,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      key: `team:${team.teamNumber}`,
      title: sortTeamTitle(team.teamNumber),
      starSum: team.starSum,
      occupancyText:
        isIncomplete && outfieldPerTeam !== null
          ? `${team.playerCount}/${outfieldPerTeam}`
          : null,
      isIncomplete,
      missingText: missing > 0 ? sortMissingToComplete(missing) : null,
      headerAccessibilityLabel: header,
      players: team.players.map((player) => playerView(player, leaveActionFor)),
      goalkeeper: team.goalkeeper
        ? goalkeeperView(team.goalkeeper, leaveActionFor)
        : null,
    };
  });
}
