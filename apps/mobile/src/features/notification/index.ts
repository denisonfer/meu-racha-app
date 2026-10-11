export * from "./screens/notifications/notifications-screen";
export * from "./hooks/use-unseen-notifications-count";
export { tabBadgeA11y } from "./utils/notification-messages";
export { usePush } from "./push/use-push";
export { usePushPermission } from "./push/use-push-permission";
export { pushEnabledKey, usePushEnabled } from "./hooks/use-push-enabled";
export {
  askPushPermissionOnce,
  registerPushToken,
  requestPushPermission,
  unregisterPushToken,
} from "./push/push-device";
export type { TPushPermission } from "./push/push-device";
// a chave aparece nas Configurações do Perfil, mas a RPC fica com o resto do push
export { setPushEnabled } from "./notification-api";
