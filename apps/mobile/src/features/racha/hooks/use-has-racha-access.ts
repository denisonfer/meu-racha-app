import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { rachaApi } from "../racha-api";
import { isNoAccessError } from "../utils/no-access";
import { rachaKey } from "./use-racha";

// o not_allowed de uma ação também vem de quem perdeu o acesso: recarrega o Racha
// pra o toast de "sem permissão" só aparecer se a pessoa ainda é Membro; quem
// perdeu o acesso sai pelo useLeaveOnNoAccess, e o cartão da aba Rachas explica
export function useHasRachaAccess(rachaId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return async () => {
    try {
      await queryClient.fetchQuery({
        queryKey: rachaKey(rachaId),
        queryFn: () => rachaApi.getRacha(rachaId, session!.userId),
        staleTime: 0,
      });
      return true;
    } catch (error) {
      return !isNoAccessError(error);
    }
  };
}
