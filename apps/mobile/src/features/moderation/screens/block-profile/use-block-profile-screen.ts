import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { invalidateBlockViews, useRachaMembers } from "@/features/racha";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { blockedProfilesKey } from "../../hooks/use-blocked-profiles";
import { moderationApi } from "../../moderation-api";
import {
  BLOCK_FAILED,
  blocked,
  firstName,
} from "../../utils/moderation-messages";

export function useBlockProfileScreen() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { data: members } = useRachaMembers(id);
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isBlocking, setIsBlocking] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const name = members?.find((m) => m.profileId === profileId)?.displayName;

  const confirm = async () => {
    if (name === undefined || isBlocking) return;
    setFailureMessage(null);
    setIsBlocking(true);
    try {
      await moderationApi.blockProfile(profileId);
    } catch {
      if (!navigation.isFocused()) {
        showToast(BLOCK_FAILED);
        return;
      }
      setIsBlocking(false);
      setFailureMessage(BLOCK_FAILED);
      return;
    }
    invalidateBlockViews(queryClient);
    void queryClient.invalidateQueries({ queryKey: blockedProfilesKey });
    // a pessoa acabou de sumir de Membros: a tela dela fecha junto com a folha
    router.dismissTo(`/racha/${id}/members`);
    showToast(blocked(name), "success");
  };

  return {
    name,
    firstName: name === undefined ? "" : firstName(name),
    isBlocking,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
