import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const openEventsKey = (rachaId: string) =>
  ["racha", rachaId, "events"] as const;

export function useOpenEvents(rachaId: string) {
  // quem redireciona com esta leitura espera fetchStatus === "idle"
  return useQuery({
    queryKey: openEventsKey(rachaId),
    queryFn: () => rachaApi.listOpenEvents(rachaId),
    // o cron só muda Eventos abertos; sem nenhum, o foco já atualiza a agenda
    refetchInterval: (query) => (query.state.data?.length ? 60_000 : false),
  });
}
