import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useRacha } from "../../hooks/use-racha";
import { useRachaMembers } from "../../hooks/use-racha-members";
import { useTransferOwnership } from "../../hooks/use-transfer-ownership";
import {
  ACTION_FAILED,
  MEMBER_GONE,
  NOT_OWNER,
  OWNERSHIP_TRANSFERRED,
  TRANSFER_PLAN_LIMIT,
} from "../../utils/racha-messages";

export function useTransferOwnershipScreen() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { data: racha } = useRacha(id);
  const { data: members } = useRachaMembers(id);
  const { transferOwnership } = useTransferOwnership(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  // guardados no primeiro render: as consultas recarregam quando o cargo muda e o título não pode sumir
  const [rachaName] = useState(() => racha?.name);
  const [name] = useState(
    () => members?.find((m) => m.profileId === profileId)?.displayName
  );
  const [isTransferring, setIsTransferring] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = name === undefined || rachaName === undefined;
  useEffect(() => {
    if (!isMissing) return;
    router.dismissTo(`/racha/${id}/members`);
    showToast(MEMBER_GONE);
  }, [isMissing, id, showToast]);

  const confirm = async () => {
    if (name === undefined) return;
    setFailureMessage(null);
    setIsTransferring(true);
    try {
      await transferOwnership(profileId);
      // isTransferring fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha
      router.dismissTo(`/racha/${id}`);
      showToast(OWNERSHIP_TRANSFERRED(name), "success");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "not_member") {
        router.dismissTo(`/racha/${id}/members`);
        showToast(MEMBER_GONE);
        return;
      }
      if (code === "not_allowed") {
        router.dismissTo(`/racha/${id}`);
        showToast(NOT_OWNER);
        return;
      }
      const message =
        code === "plan_owner_limit" ? TRANSFER_PLAN_LIMIT(name) : ACTION_FAILED;
      // a folha pode ter perdido o foco (fechada no arrasto): sem a tela em foco
      // pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(message);
        return;
      }
      setIsTransferring(false);
      setFailureMessage(message);
    }
  };

  return {
    rachaName,
    name,
    isTransferring,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
