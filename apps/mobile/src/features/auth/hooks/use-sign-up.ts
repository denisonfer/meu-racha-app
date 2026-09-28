import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { TSignUpInput } from "../auth-types";
import {
  PHOTO_UPLOAD_WARNING,
  signUpErrorMessage,
} from "../utils/auth-messages";

export function useSignUp() {
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: async ({ photo, ...input }: TSignUpInput) => {
      const user = await authApi.signUp(input);
      if (!photo || !user) return { user, isPhotoSaved: true };

      try {
        await authApi.uploadAvatar(user.id, photo);
        return { user, isPhotoSaved: true };
      } catch {
        return { user, isPhotoSaved: false };
      }
    },
    onSuccess: ({ isPhotoSaved }) =>
      isPhotoSaved
        ? showToast("Conta criada. Bem-vindo ao Racha!", "success")
        : showToast(PHOTO_UPLOAD_WARNING),
    onError: (error) => showToast(signUpErrorMessage(error.message)),
  });

  return {
    signUp: mutation.mutate,
    isPending: mutation.isPending,
    user: mutation.data?.user ?? null,
  };
}
