import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { loadMyProfileCard, myProfileCardKey } from "@/features/racha";

export function useMyProfileCard() {
  const { session } = useSession();

  return useQuery({
    queryKey: myProfileCardKey,
    queryFn: loadMyProfileCard,
    enabled: Boolean(session?.userId),
  });
}
