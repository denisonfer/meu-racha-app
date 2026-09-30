import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const rachaMembersKey = (rachaId: string) =>
  ["racha-members", rachaId] as const;

export function useRachaMembers(rachaId: string) {
  return useQuery({
    queryKey: rachaMembersKey(rachaId),
    queryFn: () => rachaApi.listRachaMembers(rachaId),
  });
}
