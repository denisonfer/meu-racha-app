import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export const myJoinRequestsKey = ["join-requests"] as const;

export function useMyJoinRequests() {
  return useQuery({
    queryKey: myJoinRequestsKey,
    queryFn: () => rachaApi.listMyJoinRequests(),
  });
}
