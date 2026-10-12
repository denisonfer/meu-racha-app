import { useBlockedProfiles, useUnblockProfile } from "@/features/moderation";
import { BLOCKED_NO_SHARED_RACHA } from "../../utils/settings-messages";

export function useBlockedPeopleScreen() {
  const query = useBlockedProfiles();
  const { unblock } = useUnblockProfile();
  const people = query.data ?? [];

  return {
    isLoading: query.isPending,
    isError: query.isError,
    retry: () => void query.refetch(),
    isRetrying: query.isRefetching,
    isEmpty: query.isSuccess && people.length === 0,
    people: people.map((person) => ({
      key: person.profileId,
      name: person.displayName,
      photoUrl: person.photoUrl,
      rachaLine: person.sharedRachaName ?? BLOCKED_NO_SHARED_RACHA,
      onUnblock: () =>
        unblock({
          profileId: person.profileId,
          displayName: person.displayName,
        }),
    })),
  };
}
