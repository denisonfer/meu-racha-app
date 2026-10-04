import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { rachaApi } from "../racha-api";

// abaixo de ["profile", id]: o que invalida o Perfil invalida as zonas também
export const myPositionsKey = (userId: string | undefined) =>
  ["profile", userId, "positions"] as const;

export function useMyPositions(enabled: boolean) {
  const { session } = useSession();
  const userId = session?.userId;

  return useQuery({
    queryKey: myPositionsKey(userId),
    queryFn: () => rachaApi.getMyPositions(userId!),
    enabled: enabled && Boolean(userId),
  });
}
