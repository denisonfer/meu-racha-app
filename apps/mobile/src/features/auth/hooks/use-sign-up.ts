import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TPickedImage } from "@/lib/image-picker";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { TSignUpInput } from "../auth-types";
import { signUpErrorMessage } from "../utils/auth-messages";
import { setPhotoHold } from "./use-photo-hold";
import { useUploadAvatar } from "./use-upload-avatar";

export function useSignUp() {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const upload = useUploadAvatar();
  // conta já criada, foto não salva: a pessoa fica no Cadastro até salvar
  const [photoOwnerId, setPhotoOwnerId] = useState<string | null>(null);

  function enterApp() {
    showToast("Conta criada. Bem-vindo ao Racha!", "success");
    setPhotoHold(false);
  }

  const mutation = useMutation({
    mutationFn: async ({ photo, ...input }: TSignUpInput) => {
      // antes do signUp: a sessão nova dispara o guard ainda dentro dele
      setPhotoHold(true);
      const user = await authApi.signUp(input);
      if (!photo || !user) return null;

      try {
        await authApi.uploadAvatar(user.id, photo);
        return null;
      } catch {
        return user.id;
      }
    },
    onSuccess: (failedPhotoOwnerId) => {
      if (failedPhotoOwnerId) {
        setPhotoOwnerId(failedPhotoOwnerId);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      enterApp();
    },
    onError: (error) => {
      setPhotoHold(false);
      showToast(signUpErrorMessage(error.message));
    },
  });

  function retryPhoto(photo: TPickedImage) {
    if (!photoOwnerId || upload.isPending) return;
    upload.mutate({ userId: photoOwnerId, photo }, { onSuccess: enterApp });
  }

  return {
    signUp: mutation.mutate,
    isPending: mutation.isPending,
    isPhotoFailed: photoOwnerId !== null,
    retryPhoto,
    isRetryingPhoto: upload.isPending,
  };
}
