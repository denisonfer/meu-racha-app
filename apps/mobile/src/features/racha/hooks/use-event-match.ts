import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const eventMatchKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "match"] as const;

/** Retrato do momento: Partida aberta ou próximo confronto. */
export function useEventMatch(rachaId: string, eventId: string) {
  return useQuery({
    queryKey: eventMatchKey(rachaId, eventId),
    queryFn: () => rachaApi.getEventMatch(eventId),
  });
}
