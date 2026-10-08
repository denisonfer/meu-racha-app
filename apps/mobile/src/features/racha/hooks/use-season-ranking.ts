import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const seasonRankingKey = (rachaId: string) =>
  ["season-ranking", rachaId] as const;

export function useSeasonRanking(rachaId: string) {
  return useQuery({
    queryKey: seasonRankingKey(rachaId),
    queryFn: () => rachaApi.getSeasonRanking(rachaId),
    enabled: Boolean(rachaId),
  });
}
