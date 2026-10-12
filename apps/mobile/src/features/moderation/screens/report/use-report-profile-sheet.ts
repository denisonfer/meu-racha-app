import { router, useLocalSearchParams } from "expo-router";
import { useRachaMembers } from "@/features/racha";
import type { TReportTarget } from "./use-report-sheet";

export function useReportProfileSheet(): TReportTarget | null {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { data: members } = useRachaMembers(id);
  const member = members?.find((m) => m.profileId === profileId);
  if (!member) return null;

  return {
    kind: "profile",
    id: profileId,
    name: member.displayName,
    onBlock: member.isBlocked
      ? null
      : () => router.replace(`/racha/${id}/member/${profileId}/block`),
  };
}
