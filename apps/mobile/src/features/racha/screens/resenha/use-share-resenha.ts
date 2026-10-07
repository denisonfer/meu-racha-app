import { useRef, useState } from "react";
import { Image, PixelRatio, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { shareAsync } from "expo-sharing";
import { useToast } from "@/ui/components";
import {
  RESENHA_SHARE_DIALOG,
  RESENHA_SHARE_FAILED,
} from "../../utils/racha-messages";

function isShareCancel(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /cancel/i.test(error.message);
}

export function useShareResenha() {
  const posterRef = useRef<View>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const showToast = useToast();

  const share = async (photoUrl: string | null) => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      if (photoUrl) {
        try {
          await Image.prefetch(photoUrl);
        } catch {
          // sem foto carregada, a carta cai nas iniciais
        }
      }
      const uri = await captureRef(posterRef, {
        format: "png",
        width: 1080 / PixelRatio.get(),
        height: 1350 / PixelRatio.get(),
        result: "tmpfile",
      });
      await shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: RESENHA_SHARE_DIALOG,
      });
    } catch (error) {
      if (isShareCancel(error)) return;
      showToast(RESENHA_SHARE_FAILED, "danger");
    } finally {
      setIsGenerating(false);
    }
  };

  return { posterRef, share, isGenerating };
}
