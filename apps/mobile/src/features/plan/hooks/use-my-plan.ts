import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { getMyPlan } from "../plan-api";

export const planKey = (userId: string) => ["my-plan", userId] as const;

export function useMyPlan() {
  const { session } = useSession();
  const userId = session?.userId;

  return useQuery({
    queryKey: planKey(userId ?? ""),
    queryFn: getMyPlan,
    enabled: Boolean(userId),
  });
}
