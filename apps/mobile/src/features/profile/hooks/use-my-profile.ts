import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { profileApi } from "../profile-api";

export const profileKey = (userId: string | undefined) =>
  ["profile", userId] as const;

export function useMyProfile() {
  const { session } = useSession();
  const userId = session?.userId;

  return useQuery({
    queryKey: profileKey(userId),
    queryFn: () => profileApi.getMyProfile(userId!),
    enabled: Boolean(userId),
  });
}
