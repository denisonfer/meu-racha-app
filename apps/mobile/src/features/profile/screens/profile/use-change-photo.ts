import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PHOTO_PICK_ERROR, useSession, useUploadAvatar } from "@/features/auth";
import { myProfileCardKey } from "@/features/racha";
import { pickAvatar } from "@/lib/image-picker";
import { useToast } from "@/ui/components";

export function useChangePhoto() {
  const { session } = useSession();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const upload = useUploadAvatar();
  const [isPicking, setIsPicking] = useState(false);

  async function changePhoto() {
    const userId = session?.userId;
    if (!userId || isPicking || upload.isPending) return;

    setIsPicking(true);
    try {
      const photo = await pickAvatar();
      if (!photo) return;
      upload.mutate(
        { userId, photo },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: myProfileCardKey }),
        }
      );
    } catch {
      showToast(PHOTO_PICK_ERROR);
    } finally {
      setIsPicking(false);
    }
  }

  return { changePhoto, isChangingPhoto: isPicking || upload.isPending };
}
