import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const rachaLastResenhaKey = (rachaId: string) =>
  ["racha", rachaId, "last-resenha"] as const;

export function useRachaLastResenha(rachaId: string) {
  return useQuery({
    queryKey: rachaLastResenhaKey(rachaId),
    queryFn: () => rachaApi.getRachaLastResenha(rachaId),
    enabled: Boolean(rachaId),
  });
}
