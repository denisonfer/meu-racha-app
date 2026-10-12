import { useQuery } from "@tanstack/react-query";
import { moderationApi } from "../moderation-api";

export const blockedProfilesKey = ["blocked-profiles"] as const;

export function useBlockedProfiles() {
  return useQuery({
    queryKey: blockedProfilesKey,
    queryFn: moderationApi.getBlockedProfiles,
  });
}
