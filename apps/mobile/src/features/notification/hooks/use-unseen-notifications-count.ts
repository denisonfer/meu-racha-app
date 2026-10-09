import { useQuery } from "@tanstack/react-query";
import { notificationApi } from "../notification-api";

export const unseenNotificationsKey = ["notifications-unseen"] as const;

export function useUnseenNotificationsCount() {
  return useQuery({
    queryKey: unseenNotificationsKey,
    queryFn: () => notificationApi.getUnseenNotificationsCount(),
    // O QueryClient deixa a query fresca por 30s, e o refetch de foco
    // padrão pula o que não está stale. 'always' existe no query-core 5.103.2
    // e relê ao voltar ao app mesmo dentro dessa janela.
    refetchOnWindowFocus: "always",
  });
}
