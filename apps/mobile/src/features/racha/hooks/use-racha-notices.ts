import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const rachaNoticesKey = ["racha-notices"] as const;

export function useRachaNotices() {
  return useQuery({
    queryKey: rachaNoticesKey,
    queryFn: rachaApi.listRachaNotices,
  });
}
