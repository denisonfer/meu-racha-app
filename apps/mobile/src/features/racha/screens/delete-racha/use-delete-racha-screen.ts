import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useDeleteRacha } from "../../hooks/use-delete-racha";
import { useRacha } from "../../hooks/use-racha";
import {
  DELETE_RACHA_FAILED,
  NOT_OWNER,
  RACHA_DELETED,
} from "../../utils/racha-messages";

export function useDeleteRachaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha } = useRacha(id);
  const { deleteRacha } = useDeleteRacha(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  // guardado no primeiro render: uma recarga do Racha não pode apagar o título
  const [name] = useState(() => racha?.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = name === undefined;
  useEffect(() => {
    if (isMissing) router.back();
  }, [isMissing]);

  const confirm = async () => {
    setFailureMessage(null);
    setIsDeleting(true);
    try {
      const result = await deleteRacha();
      // isDeleting fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha
      router.dismissTo("/rachas");
      if (result === "deleted") showToast(RACHA_DELETED, "success");
      else showToast(NOT_OWNER);
    } catch {
      // a folha pode ter perdido o foco (fechada no arrasto, o que o Android não deixa impedir):
      // sem a tela em foco pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(DELETE_RACHA_FAILED);
        return;
      }
      setIsDeleting(false);
      setFailureMessage(DELETE_RACHA_FAILED);
    }
  };

  return {
    name,
    isDeleting,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
