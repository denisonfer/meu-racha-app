import {
  NOTIFICATION_KINDS,
  NOTIFICATION_PAYLOAD_INVALID,
  NOTIFICATION_TARGETS,
  parseNotifications,
  type TNotification,
} from "@meu-racha/domain";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// status 0 = o pedido nem chegou ao servidor; o resto vira o código do banco
function toCodedError(error: PostgrestError, status: number): Error {
  if (status === 0) return new Error("network_error");
  return new Error(error.code || error.message);
}

async function getNotifications(): Promise<TNotification[]> {
  const { data, error, status } = await supabase.rpc("get_notifications");
  if (error) throw toCodedError(error, status);
  return parseNotifications(data);
}

async function getUnseenNotificationsCount(): Promise<number> {
  const { data, error, status } = await supabase.rpc(
    "get_unseen_notifications_count"
  );
  if (error) throw toCodedError(error, status);
  return data ?? 0;
}

async function markNotificationsSeen(): Promise<void> {
  const { error, status } = await supabase.rpc("mark_notifications_seen");
  if (error) throw toCodedError(error, status);
}

async function registerPushToken(
  token: string,
  platform: "ios" | "android"
): Promise<void> {
  const { error, status } = await supabase.rpc("register_push_token", {
    p_token: token,
    p_platform: platform,
  });
  if (error) throw toCodedError(error, status);
}

async function unregisterPushToken(token: string): Promise<void> {
  const { error, status } = await supabase.rpc("unregister_push_token", {
    p_token: token,
  });
  if (error) throw toCodedError(error, status);
}

export async function setRachaPushMuted(
  rachaId: string,
  muted: boolean
): Promise<void> {
  const { error, status } = await supabase.rpc("set_racha_push_muted", {
    p_racha_id: rachaId,
    p_muted: muted,
  });
  if (error) throw toCodedError(error, status);
}

export async function getRachaPushMuted(rachaId: string): Promise<boolean> {
  const { data, error, status } = await supabase.rpc("get_racha_push_muted", {
    p_racha_id: rachaId,
  });
  if (error) throw toCodedError(error, status);
  return data ?? false;
}

const openedNotificationSchema = z.object({
  kind: z.enum(NOTIFICATION_KINDS),
  racha_id: z.string(),
  event_id: z.string().nullable(),
  target: z.enum(NOTIFICATION_TARGETS),
});

export type TOpenedNotification = {
  kind: TNotification["kind"];
  target: TNotification["target"];
  rachaId: string;
  eventId: string | null;
};

// marca só este Aviso como visto e devolve o destino calculado agora
async function openNotification(id: string): Promise<TOpenedNotification> {
  const { data, error, status } = await supabase.rpc("open_notification", {
    p_id: id,
  });
  if (error) throw toCodedError(error, status);
  const parsed = openedNotificationSchema.safeParse(data);
  if (!parsed.success) throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  return {
    kind: parsed.data.kind,
    target: parsed.data.target,
    rachaId: parsed.data.racha_id,
    eventId: parsed.data.event_id,
  };
}

export const notificationApi = {
  getNotifications,
  getUnseenNotificationsCount,
  markNotificationsSeen,
  registerPushToken,
  unregisterPushToken,
  setRachaPushMuted,
  getRachaPushMuted,
  openNotification,
};
