import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const rachaPixKeyKey = (rachaId: string) =>
  ["racha", rachaId, "pix-key"] as const;

// a RPC só responde a Dono e Admin: quem chama decide com `enabled`
export function useRachaPixKey(rachaId: string, enabled = true) {
  return useQuery({
    queryKey: rachaPixKeyKey(rachaId),
    queryFn: () => rachaApi.getRachaPixKey(rachaId),
    enabled,
  });
}
