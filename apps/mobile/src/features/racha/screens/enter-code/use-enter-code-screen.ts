import { INVITE_CODE_LENGTH } from "@meu-racha/domain";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard } from "react-native";
import { inviteKey } from "../../hooks/use-invite";
import { rachaApi } from "../../racha-api";
import {
  INVITE_CHECK_FAILED,
  INVITE_CODE_INVALID,
} from "../../utils/racha-messages";

export function useEnterCodeScreen() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<"invalid" | "network" | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isComplete = code.length === INVITE_CODE_LENGTH;

  // o campo já entrega o código normalizado
  const changeCode = (next: string) => {
    setCode(next);
    setFailure(null);
  };

  const submit = async () => {
    if (!isComplete || isChecking) return;
    Keyboard.dismiss();
    setFailure(null);
    setIsChecking(true);
    try {
      // pela mesma chave do Convite: a tela 5 abre com o dado já no cache
      const invite = await queryClient.fetchQuery({
        queryKey: inviteKey(code),
        queryFn: () => rachaApi.getInvite(code),
        // rede caída: erro na hora; a pessoa toca Continuar de novo
        retry: false,
      });
      if (invite) router.push(`/r/${code}`);
      else setFailure("invalid");
    } catch {
      setFailure("network");
    } finally {
      setIsChecking(false);
    }
  };

  return {
    code,
    changeCode,
    codeError: failure === "invalid" ? INVITE_CODE_INVALID : null,
    networkError: failure === "network" ? INVITE_CHECK_FAILED : null,
    isChecking,
    canSubmit: isComplete,
    submit: () => void submit(),
  };
}
