import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { changePasswordErrorMessage } from "../utils/auth-messages";

export function useChangePassword() {
  const showToast = useToast();

  const passwordChanged = useRef(false);

  const mutation = useMutation({
    mutationFn: async (password: string) => {
      if (!passwordChanged.current) {
        await authApi.changePassword(password);
        passwordChanged.current = true;
      }
      await authApi.signOutOtherSessions();
    },
    onError: (error) => showToast(changePasswordErrorMessage(error.message)),
  });

  return { changePassword: mutation.mutate, isPending: mutation.isPending };
}
