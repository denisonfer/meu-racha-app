import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { unseenNotificationsKey } from "../hooks/use-unseen-notifications-count";
import { notificationApi } from "../notification-api";
import { notificationsKey } from "../screens/notifications/use-notifications-screen";
import { handlePushTap } from "./push-tap";
import { registerPushToken } from "./push-device";

// Fica no layout autenticado antes do retorno da carga: o toque que abriu o
// app só é tratado quando há sessão.
export function usePush(userId: string | null) {
  const queryClient = useQueryClient();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    void registerPushToken();
    const tokenSubscription = Notifications.addPushTokenListener(
      (token) => void registerPushToken(token)
    );
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      () => {
        void queryClient.invalidateQueries({
          queryKey: unseenNotificationsKey,
        });
        void queryClient.invalidateQueries({ queryKey: notificationsKey });
      }
    );
    return () => {
      tokenSubscription.remove();
      receivedSubscription.remove();
    };
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const { request } = response.notification;
    void handlePushTap(
      {
        responseId: request.identifier,
        notificationId: request.content.data?.notificationId,
      },
      handled.current,
      {
        open: notificationApi.openNotification,
        // A função pura devolve string; o router só aceita o Href das rotas.
        navigate: (href) => router.push(href as Href),
        done: () => {
          void queryClient.invalidateQueries({
            queryKey: unseenNotificationsKey,
          });
          Notifications.clearLastNotificationResponse();
        },
      }
    );
  }, [queryClient, response, userId]);
}
