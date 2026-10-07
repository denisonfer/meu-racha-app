import { OVERALL_MIN, roleBadge } from "@meu-racha/domain";
import { keeperStats, lineStats } from "@/ui/components";
import { TRachaMember } from "../racha-types";

const ZERO_LINE = { wins: 0, goals: 0, assists: 0, games: 0 };
const ZERO_KEEPER = { wins: 0, cleanSheets: 0, goals: 0, games: 0 };

/** Carta do Membro no Racha; sem Partidas ainda, estatísticas zeradas e Overall de entrada. */
export const memberCardProps = (
  member: Pick<
    TRachaMember,
    "displayName" | "photoUrl" | "playsAs" | "primaryPosition"
  >,
  isSuperStar: boolean
) => ({
  overall: OVERALL_MIN,
  name: member.displayName,
  photoUri: member.photoUrl,
  badge: roleBadge(member.playsAs, member.primaryPosition),
  stats:
    member.playsAs === "GOALKEEPER"
      ? keeperStats(ZERO_KEEPER)
      : lineStats(ZERO_LINE),
  context: "Overall de entrada",
  isSuperStar,
});
