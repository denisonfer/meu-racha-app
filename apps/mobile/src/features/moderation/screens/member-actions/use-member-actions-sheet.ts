import { router, useLocalSearchParams } from "expo-router";
import { useRacha, useRachaMembers } from "@/features/racha";
import { useBottomSheetClose } from "@/ui/components";
import { useUnblockProfile } from "../../hooks/use-unblock-profile";
import { firstName } from "../../utils/moderation-messages";

export function useMemberActionsSheet() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { data: members } = useRachaMembers(id);
  const { data: racha } = useRacha(id);
  const { unblock } = useUnblockProfile();
  const close = useBottomSheetClose();
  const member = members?.find((m) => m.profileId === profileId);

  return {
    member: member && {
      name: member.displayName,
      firstName: firstName(member.displayName),
      photoUrl: member.photoUrl,
      isBlocked: member.isBlocked,
    },
    rachaName: racha?.name ?? "",
    // troca a folha em vez de empilhar: voltar não reabre esta
    openReport: () => router.replace(`/racha/${id}/member/${profileId}/report`),
    openBlock: () => router.replace(`/racha/${id}/member/${profileId}/block`),
    unblock: () => {
      if (!member) return;
      unblock({ profileId, displayName: member.displayName });
      close();
    },
  };
}
