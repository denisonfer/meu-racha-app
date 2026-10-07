import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const eventResenhaKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "resenha"] as const;

export function useEventResenha(rachaId: string, eventId: string) {
  return useQuery({
    queryKey: eventResenhaKey(rachaId, eventId),
    queryFn: () => rachaApi.getEventResenha(eventId),
    enabled: Boolean(rachaId && eventId),
  });
}
