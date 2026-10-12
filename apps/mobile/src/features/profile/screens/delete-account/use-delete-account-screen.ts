import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useNavigation, type Href } from "expo-router";
import { useState } from "react";
import { signOutDeletedAccount, useSession } from "@/features/auth";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { profileApi } from "../../profile-api";
import {
  ACCOUNT_DELETED,
  DELETE_ACCOUNT_FAILED,
} from "../../utils/settings-messages";
import {
  deleteAccount,
  deleteAccountSheet,
  loseRachasLine,
} from "./delete-account-flow";

export function useDeleteAccountScreen() {
  const { session } = useSession();
  const userId = session?.userId;
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  // sem cache: cada abertura confere de novo (pode ter virado Dono há pouco)
  const check = useQuery({
    queryKey: ["account-deletion-check", userId],
    queryFn: profileApi.getAccountDeletionCheck,
    enabled: Boolean(userId),
    gcTime: 0,
    staleTime: 0,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const confirm = async () => {
    if (!userId) return;
    setFailureMessage(null);
    setIsDeleting(true);
    const result = await deleteAccount({
      removeAvatarFiles: () => profileApi.removeMyAvatarFiles(userId),
      deleteMyAccount: profileApi.deleteMyAccount,
      endSession: signOutDeletedAccount,
      clearCache: () => queryClient.clear(),
      goToSignIn: () => router.replace("/sign-in"),
      showDeleted: () => showToast(ACCOUNT_DELETED, "success"),
    });
    // isDeleting fica true no sucesso: a folha sai junto com a sessão
    if (result === "deleted") return;
    if (result === "blocked") {
      // a mesma folha vira a de bloqueio com a consulta nova
      await check.refetch();
      setIsDeleting(false);
      return;
    }
    // a folha pode ter perdido o foco (fechada no arrasto do Android)
    if (!navigation.isFocused()) {
      showToast(DELETE_ACCOUNT_FAILED);
      return;
    }
    setIsDeleting(false);
    setFailureMessage(DELETE_ACCOUNT_FAILED);
  };

  const leaveTo = (href: Href) => {
    router.dismiss();
    router.push(href);
  };

  return {
    sheet: check.data ? deleteAccountSheet(check.data) : null,
    hasCheckFailed: check.isError,
    retryCheck: () => void check.refetch(),
    loseRachas: check.data ? loseRachasLine(check.data.rachaCount) : null,
    ownedRachas: check.data?.ownedRachas ?? [],
    conducting: check.data?.conducting ?? [],
    isDeleting,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
    openRacha: (rachaId: string) => leaveTo(`/racha/${rachaId}`),
    openEvent: (rachaId: string, eventId: string) =>
      leaveTo(`/racha/${rachaId}/event/${eventId}/match`),
  };
}
