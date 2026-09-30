import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { isNoAccessError } from "../utils/no-access";
import { myRachasKey } from "./use-my-rachas";
import { rachaNoticesKey } from "./use-racha-notices";

// quem perdeu o acesso com o Racha aberto volta para a aba Rachas, que já
// mostra o aviso do motivo
export function useLeaveOnNoAccess(error: unknown) {
  const queryClient = useQueryClient();
  const isNoAccess = isNoAccessError(error);

  useEffect(() => {
    if (!isNoAccess) return;
    void queryClient.invalidateQueries({ queryKey: myRachasKey });
    void queryClient.invalidateQueries({ queryKey: rachaNoticesKey });
    router.dismissTo("/rachas");
  }, [isNoAccess, queryClient]);

  return isNoAccess;
}
