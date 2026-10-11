import { useQuery } from "@tanstack/react-query";
import { notificationApi } from "../notification-api";

export const pushEnabledKey = ["push-enabled"] as const;

// undefined enquanto não leu: quem decide pela chave espera a resposta
export function usePushEnabled(): boolean | undefined {
  const { data } = useQuery({
    queryKey: pushEnabledKey,
    queryFn: () => notificationApi.getPushEnabled(),
  });
  return data;
}
