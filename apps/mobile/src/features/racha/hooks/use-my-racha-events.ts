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
  });
}
