import { OVERALL_MIN, roleBadge } from "@meu-racha/domain";
import { useSignOut } from "@/features/auth";
import { keeperStats, lineStats } from "@/ui/components";
import { useMyProfile } from "../../hooks/use-my-profile";

const ZERO_LINE = { wins: 0, goals: 0, assists: 0, games: 0 };
const ZERO_KEEPER = { wins: 0, cleanSheets: 0, goals: 0, games: 0 };

export function useProfileScreen() {
  const { data: profile, isPending, refetch, isRefetching } = useMyProfile();
  const { signOut, isPending: isSigningOut } = useSignOut();

  const card = profile && {
    overall: OVERALL_MIN,
    name: profile.displayName,
    photoUri: profile.photoUri,
    badge: roleBadge(profile.playsAs, profile.primaryPosition),
    stats:
      profile.playsAs === "GOALKEEPER"
        ? keeperStats(ZERO_KEEPER)
        : lineStats(ZERO_LINE),
    context: "sem Racha ainda",
  };

  return {
    card,
    isLoading: isPending,
    retry: () => void refetch(),
    isRetrying: isRefetching,
    signOut: () => signOut(),
    isSigningOut,
  };
}
