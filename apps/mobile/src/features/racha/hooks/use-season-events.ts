import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const seasonEventsKey = (rachaId: string) =>
  ["season-events", rachaId] as const;

export function useSeasonEvents(rachaId: string) {
  return useQuery({
    queryKey: seasonEventsKey(rachaId),
    queryFn: () => rachaApi.getSeasonEvents(rachaId),
    enabled: Boolean(rachaId),
  });
}
