import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { registerPushToken } from "./push-device";

// Relê ao focar e ao voltar dos Ajustes: a pessoa pode ter mudado lá fora.
export function usePushPermissionDenied(): boolean {
  const [denied, setDenied] = useState(false);
  const wasDenied = useRef(false);

  const check = useCallback(async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (wasDenied.current && permission.granted) void registerPushToken();
      wasDenied.current = permission.status === "denied";
      setDenied(wasDenied.current);
    } catch {
      // sem leitura, o aviso não aparece: ele é ajuda, não bloqueio
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => subscription.remove();
  }, [check]);

  return denied;
}
