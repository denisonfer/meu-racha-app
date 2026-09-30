import { FetchStatus, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { isNoAccessError } from "../utils/no-access";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";
import { rachaMembersKey } from "./use-racha-members";
import { rachaNoticesKey } from "./use-racha-notices";

// quem perdeu o acesso com o Racha aberto volta para a aba Rachas, que já
// mostra o aviso do motivo. Só age com a consulta parada: ao remontar, o cache
// traz o erro velho até a recarga terminar, e quem foi reaprovado seria expulso
// da home; ao sair, o cache do Racha é descartado pelo mesmo motivo
export function useLeaveOnNoAccess(
  error: unknown,
  fetchStatus: FetchStatus,
  rachaId: string
) {
  const queryClient = useQueryClient();
  const isNoAccess = isNoAccessError(error) && fetchStatus === "idle";

  useEffect(() => {
    if (!isNoAccess) return;
    queryClient.removeQueries({ queryKey: rachaKey(rachaId) });
    queryClient.removeQueries({ queryKey: rachaMembersKey(rachaId) });
    void queryClient.invalidateQueries({ queryKey: myRachasKey });
    void queryClient.invalidateQueries({ queryKey: rachaNoticesKey });
    router.dismissTo("/rachas");
  }, [isNoAccess, queryClient, rachaId]);

  return isNoAccess;
}
