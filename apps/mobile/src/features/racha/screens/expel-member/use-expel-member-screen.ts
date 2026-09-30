import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useExpelMember } from "../../hooks/use-expel-member";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useRachaMembers } from "../../hooks/use-racha-members";
import {
  ACTION_FAILED,
  MEMBER_EXPELLED,
  MEMBER_GONE,
  MEMBER_NOT_ALLOWED,
} from "../../utils/racha-messages";

export function useExpelMemberScreen() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { data: members } = useRachaMembers(id);
  const { expelMember } = useExpelMember(id);
  const hasRachaAccess = useHasRachaAccess(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  // guardado no primeiro render: a lista recarrega quando o Membro sai e o título não pode sumir
  const [name] = useState(
    () => members?.find((m) => m.profileId === profileId)?.displayName
  );
  const [isExpelling, setIsExpelling] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = name === undefined;
  useEffect(() => {
    if (!isMissing) return;
    router.dismissTo(`/racha/${id}/members`);
    showToast(MEMBER_GONE);
  }, [isMissing, id, showToast]);

  const confirm = async () => {
    if (name === undefined) return;
    setFailureMessage(null);
    setIsExpelling(true);
    try {
      await expelMember(profileId);
      // isExpelling fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha
      router.dismissTo(`/racha/${id}/members`);
      showToast(MEMBER_EXPELLED(name), "success");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "not_member") {
        router.dismissTo(`/racha/${id}/members`);
        showToast(MEMBER_GONE);
        return;
      }
      if (code === "not_allowed") {
        router.dismissTo(`/racha/${id}`);
        if (await hasRachaAccess()) showToast(MEMBER_NOT_ALLOWED);
        return;
      }
      // a folha pode ter perdido o foco (fechada no arrasto): sem a tela em foco
      // pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsExpelling(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    name,
    isExpelling,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
