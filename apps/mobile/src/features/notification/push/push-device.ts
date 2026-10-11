import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationApi } from "../notification-api";

let currentToken: string | null = null;

// No Android 13 o pedido de permissão só aparece depois que existe um canal.
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Avisos",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// "Uma vez" é o estado do sistema: só pergunta enquanto não foi decidida.
export async function askPushPermissionOnce(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== "undetermined") return current.granted;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (error) {
    console.warn("push: pedido de permissão falhou", error);
    return false;
  }
}

export function getCurrentPushToken(): string | null {
  return currentToken;
}

// Sem token a pessoa ainda tem a aba: a falha não aparece, só vai ao console.
export async function registerPushToken(
  devicePushToken?: Notifications.DevicePushToken
): Promise<void> {
  const platform = Platform.OS;
  if (platform !== "ios" && platform !== "android") return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await ensureAndroidChannel();
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    // o token do listener entra direto: pedir outro ali dispararia o listener de novo
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId,
      devicePushToken,
    });
    await notificationApi.registerPushToken(data, platform);
    currentToken = data;
  } catch (error) {
    console.warn("push: registro do token falhou", error);
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!currentToken) return;
  await notificationApi.unregisterPushToken(currentToken);
  currentToken = null;
}
