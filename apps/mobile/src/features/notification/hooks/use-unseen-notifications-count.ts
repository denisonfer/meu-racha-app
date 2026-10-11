import { useQuery } from "@tanstack/react-query";
import { setBadgeCountAsync } from "expo-notifications";
import { useEffect } from "react";
import { notificationApi } from "../notification-api";

export const unseenNotificationsKey = ["notifications-unseen"] as const;

export function useUnseenNotificationsCount() {
  const query = useQuery({
    queryKey: unseenNotificationsKey,
    queryFn: () => notificationApi.getUnseenNotificationsCount(),
    // O QueryClient deixa a query fresca por 30s, e o refetch de foco
    // padrão pula o que não está stale. 'always' existe no query-core 5.103.2
    // e relê ao voltar ao app mesmo dentro dessa janela.
    refetchOnWindowFocus: "always",
  });
  const { data } = query;

  // O ícone acompanha o contador. O false do launcher sem número é aceito.
  useEffect(() => {
    if (data !== undefined) void setBadgeCountAsync(data);
  }, [data]);

  return query;
}
