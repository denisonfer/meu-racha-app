import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { changePasswordErrorMessage } from "../utils/auth-messages";

export function useChangePassword() {
  const showToast = useToast();

  // Só vira true depois que o updateUser passou. A tela trava os campos nesse
  // estado, então o toque seguinte só encerra as sessões e nunca descarta uma
  // senha redigitada; antes disso, toda senha digitada é gravada.
  const [isPasswordChanged, setIsPasswordChanged] = useState(false);

  const mutation = useMutation({
    mutationFn: async (password: string) => {
      if (!isPasswordChanged) {
        await authApi.changePassword(password);
        setIsPasswordChanged(true);
      }

      try {
        await authApi.signOutOtherSessions();
      } catch {
        throw new Error("sessions_not_ended");
      }
    },
    onError: (error) => showToast(changePasswordErrorMessage(error.message)),
  });

  return {
    changePassword: mutation.mutate,
    isPending: mutation.isPending,
    isPasswordChanged,
  };
}
