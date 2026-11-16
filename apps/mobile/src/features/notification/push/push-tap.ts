import type { TOpenedNotification } from "../notification-api";
import { notificationHref } from "../screens/notifications/notification-href";

export const NOTIFICATIONS_TAB_HREF = "/notifications";

export type TPushTap = {
  responseId: string;
  notificationId: unknown;
};

export type TPushTapDeps = {
  open: (notificationId: string) => Promise<TOpenedNotification>;
  navigate: (href: string) => void;
  done: () => void;
};

// O hook do toque devolve a mesma resposta até ela ser limpa, e o efeito pode
// rodar de novo antes disso: `handled` impede abrir o Aviso duas vezes.
export async function handlePushTap(
  tap: TPushTap,
  handled: Set<string>,
  deps: TPushTapDeps
): Promise<void> {
  if (handled.has(tap.responseId)) return;
  handled.add(tap.responseId);

  let href: string | null = null;
  if (typeof tap.notificationId === "string") {
    try {
      const opened = await deps.open(tap.notificationId);
      if (opened.kind !== "unknown") href = notificationHref(opened);
    } catch {
      // Aviso que sumiu ou sem rede: a aba é a fonte da verdade
    }
  }
  deps.navigate(href ?? NOTIFICATIONS_TAB_HREF);
  deps.done();
}
