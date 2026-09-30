import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const rachaJoinRequestsKey = (rachaId: string) =>
  ["racha-join-requests", rachaId] as const;

export function useRachaJoinRequests(rachaId: string) {
  return useQuery({
    queryKey: rachaJoinRequestsKey(rachaId),
    queryFn: () => rachaApi.listJoinRequests(rachaId),
  });
}
