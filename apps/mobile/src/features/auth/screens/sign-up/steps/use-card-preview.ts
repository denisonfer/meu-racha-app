import { OVERALL_MIN, roleBadge } from "@meu-racha/domain";
import { Control, useWatch } from "react-hook-form";
import { keeperStats, lineStats } from "@/ui/components";
import { TSignUpFormInput } from "../sign-up-schema";

const ZERO_LINE = { wins: 0, goals: 0, assists: 0, games: 0 };
const ZERO_KEEPER = { wins: 0, cleanSheets: 0, goals: 0, games: 0 };

export function useCardPreview(control: Control<TSignUpFormInput>) {
  const [displayName, playsAs, primaryPosition, photo] = useWatch({
    control,
    name: ["displayName", "playsAs", "primaryPosition", "photo"],
  });
  const isKeeper = playsAs === "GOALKEEPER";

  return {
    overall: OVERALL_MIN,
    name: displayName ?? "",
    badge: roleBadge(
      isKeeper ? "GOALKEEPER" : "OUTFIELD",
      primaryPosition ?? null
    ),
    stats: isKeeper ? keeperStats(ZERO_KEEPER) : lineStats(ZERO_LINE),
    context: "exemplo · sem Partidas ainda",
    photoUri: photo?.uri ?? null,
  };
}
