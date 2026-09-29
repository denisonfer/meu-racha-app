import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { rachaApi } from "../racha-api";

export const rachaKey = (id: string) => ["racha", id] as const;

export function useRacha(id: string) {
  const { session } = useSession();
  const userId = session?.userId;

  return useQuery({
    queryKey: rachaKey(id),
    queryFn: () => rachaApi.getRacha(id, userId!),
    enabled: Boolean(userId && id),
  });
}
