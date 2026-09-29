import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { rachaApi } from "../racha-api";

export const myRachasKey = ["rachas"] as const;

export function useMyRachas() {
  const { session } = useSession();
  const userId = session?.userId;

  return useQuery({
    queryKey: myRachasKey,
    queryFn: () => rachaApi.listMyRachas(userId!),
    enabled: Boolean(userId),
  });
}
