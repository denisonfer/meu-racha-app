import { useEffect } from "react";
import { usePushEnabled } from "../hooks/use-push-enabled";
import { askPushPermissionOnce, registerPushToken } from "./push-device";

// Fica na home: quem chega por login ou cadastro é perguntado uma vez, entre
// num Racha ou não.
export function useAskPushPermission() {
  const pushEnabled = usePushEnabled();

  useEffect(() => {
    if (pushEnabled !== true) return;
    void askPushPermissionOnce().then((granted) =>
      granted ? registerPushToken() : undefined
    );
  }, [pushEnabled]);
}
