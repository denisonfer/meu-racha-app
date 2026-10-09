import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TPickedImage } from "@/lib/image-picker";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { PHOTO_UPLOAD_FAILED } from "../utils/auth-messages";

export function useUploadAvatar() {
  const showToast = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, photo }: { userId: string; photo: TPickedImage }) =>
      authApi.uploadAvatar(userId, photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: () => showToast(PHOTO_UPLOAD_FAILED),
  });
}
