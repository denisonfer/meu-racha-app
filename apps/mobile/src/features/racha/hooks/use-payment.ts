import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const paymentKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "payment"] as const;

export function usePayment(rachaId: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: paymentKey(rachaId, eventId),
    queryFn: () => rachaApi.getPayment(eventId),
    enabled,
  });
}
