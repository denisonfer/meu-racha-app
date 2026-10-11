import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  getPushPermission,
  registerPushToken,
  type TPushPermission,
} from "./push-device";

// Relê ao focar e ao voltar dos Ajustes: a pessoa pode ter mudado lá fora.
export function usePushPermission() {
  const [permission, setPermission] = useState<TPushPermission | null>(null);
  const wasGranted = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getPushPermission();
      if (wasGranted.current === false && next.granted) {
        void registerPushToken();
      }
      wasGranted.current = next.granted;
      setPermission(next);
    } catch {
      // sem leitura, nenhum aviso aparece: ele é ajuda, não bloqueio
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { permission, refresh };
}
