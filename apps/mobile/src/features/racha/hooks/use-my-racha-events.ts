import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { rachaApi } from "../racha-api";

export const myRachaEventsKey = ["rachas", "events"] as const;

export function useMyRachaEvents() {
  const { session } = useSession();

  return useQuery({
    queryKey: myRachaEventsKey,
    queryFn: rachaApi.listMyRachaEvents,
    enabled: Boolean(session?.userId),
    // os cartões abertos podem mudar pelo cron sem ação deste aparelho
    refetchInterval: (query) => (query.state.data?.length ? 60_000 : false),
  });
}
