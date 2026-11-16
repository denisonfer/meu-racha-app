import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ensurePurchases,
  getMyPlan,
  hasActiveEntitlement,
  purchaseAvailable,
  syncMyPlan,
} from "../plan-api";
import { planKey } from "./use-my-plan";

// o layout remonta a cada troca de sessão; a conferência é uma vez por usuário no processo
const reconciled = new Set<string>();

// devolve true quando o servidor foi chamado a sincronizar
async function identify(userId: string): Promise<boolean> {
  await ensurePurchases(userId);
  if (reconciled.has(userId)) return false;
  reconciled.add(userId);
  // compra feita com o webhook ainda a caminho (ou perdido): o servidor confere
  if (!(await hasActiveEntitlement())) return false;
  if ((await getMyPlan()).isPro) return false;
  await syncMyPlan();
  return true;
}

export function usePurchasesIdentity(userId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !purchaseAvailable()) return;
    identify(userId)
      .then((synced) => {
        if (synced)
          void queryClient.invalidateQueries({ queryKey: planKey(userId) });
      })
      // falhou (rede, loja): tenta de novo na próxima abertura da sessão
      .catch(() => reconciled.delete(userId));
  }, [queryClient, userId]);
}
