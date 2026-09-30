import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useLeaveRacha } from "../../hooks/use-leave-racha";
import { useRacha } from "../../hooks/use-racha";
import { ACTION_FAILED, LEFT_RACHA } from "../../utils/racha-messages";

export function useLeaveRachaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha } = useRacha(id);
  const { leaveRacha } = useLeaveRacha(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  // guardado no primeiro render: o Racha some do cache quando a saída dá certo e o título não pode sumir
  const [name] = useState(() => racha?.name);
  const [isLeaving, setIsLeaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = name === undefined;
  useEffect(() => {
    if (isMissing) router.back();
  }, [isMissing]);

  const confirm = async () => {
    setFailureMessage(null);
    setIsLeaving(true);
    try {
      await leaveRacha();
      // isLeaving fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha
      router.dismissTo("/rachas");
      showToast(LEFT_RACHA, "success");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      // já tinha saído (ex.: resposta perdida): o resultado é o que a pessoa queria
      if (code === "not_member") {
        router.dismissTo("/rachas");
        showToast(LEFT_RACHA, "success");
        return;
      }
      // a folha pode ter perdido o foco (fechada no arrasto): sem a tela em foco
      // pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsLeaving(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    name,
    isLeaving,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
