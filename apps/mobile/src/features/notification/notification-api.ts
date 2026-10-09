import { parseNotifications, type TNotification } from "@meu-racha/domain";
import type { PostgrestError } from "@supabase/supabase-js";
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

export const notificationApi = {
  getNotifications,
  getUnseenNotificationsCount,
  markNotificationsSeen,
};
