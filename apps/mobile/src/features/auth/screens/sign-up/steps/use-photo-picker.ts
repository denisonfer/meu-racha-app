import { useState } from "react";
import { Control, useController } from "react-hook-form";
import { pickAvatar } from "@/lib/image-picker";
import { PHOTO_PICK_ERROR } from "../../../utils/auth-messages";
import { TSignUpFormInput } from "../sign-up-schema";

export function usePhotoPicker(control: Control<TSignUpFormInput>) {
  const { field } = useController({ control, name: "photo" });
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  async function pick() {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const picked = await pickAvatar();
      if (!picked) return;
      field.onChange(picked);
      setError(null);
    } catch {
      setError(PHOTO_PICK_ERROR);
    } finally {
      setIsPicking(false);
    }
  }

  return { hasPhoto: field.value != null, isPicking, error, pick };
}
