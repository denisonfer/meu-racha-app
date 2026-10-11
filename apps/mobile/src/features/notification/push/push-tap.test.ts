import { describe, expect, mock, test } from "bun:test";
import type { TNotificationHrefInput } from "../screens/notifications/notification-href";
import { handlePushTap, NOTIFICATIONS_TAB_HREF } from "./push-tap";

const sortNotice: TNotificationHrefInput = {
  kind: "sort_confirmed",
  target: "available",
  rachaId: "r1",
  eventId: "e1",
};

function deps(open: (id: string) => Promise<TNotificationHrefInput>) {
  return { open: mock(open), navigate: mock(), done: mock() };
}

describe("handlePushTap", () => {
  test("abre o Aviso e navega pelo notificationHref", async () => {
    const d = deps(async () => sortNotice);
    await handlePushTap(
      { responseId: "a", notificationId: "n1" },
      new Set(),
      d
    );
    expect(d.open).toHaveBeenCalledWith("n1");
    expect(d.navigate).toHaveBeenCalledWith("/racha/r1/event/e1/sort");
    expect(d.done).toHaveBeenCalledTimes(1);
  });

  test("destino nulo vai para a aba Avisos", async () => {
    const d = deps(async () => ({ ...sortNotice, target: "racha_deleted" }));
    await handlePushTap(
      { responseId: "a", notificationId: "n1" },
      new Set(),
      d
    );
    expect(d.navigate).toHaveBeenCalledWith(NOTIFICATIONS_TAB_HREF);
    expect(d.done).toHaveBeenCalledTimes(1);
  });

  test("RPC que falha ou push sem id vai para a aba Avisos", async () => {
    const failing = deps(async () => {
      throw new Error("not_found");
    });
    await handlePushTap(
      { responseId: "a", notificationId: "n1" },
      new Set(),
      failing
    );
    expect(failing.navigate).toHaveBeenCalledWith(NOTIFICATIONS_TAB_HREF);

    const noId = deps(async () => sortNotice);
    await handlePushTap(
      { responseId: "b", notificationId: undefined },
      new Set(),
      noId
    );
    expect(noId.open).not.toHaveBeenCalled();
    expect(noId.navigate).toHaveBeenCalledWith(NOTIFICATIONS_TAB_HREF);
  });

  test("a mesma resposta não é tratada duas vezes", async () => {
    const d = deps(async () => sortNotice);
    const handled = new Set<string>();
    await Promise.all([
      handlePushTap({ responseId: "a", notificationId: "n1" }, handled, d),
      handlePushTap({ responseId: "a", notificationId: "n1" }, handled, d),
    ]);
    await handlePushTap({ responseId: "a", notificationId: "n1" }, handled, d);
    expect(d.open).toHaveBeenCalledTimes(1);
    expect(d.navigate).toHaveBeenCalledTimes(1);

    await handlePushTap({ responseId: "b", notificationId: "n2" }, handled, d);
    expect(d.open).toHaveBeenCalledTimes(2);
  });
});
