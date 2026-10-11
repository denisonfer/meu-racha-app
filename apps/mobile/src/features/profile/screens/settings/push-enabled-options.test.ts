import { describe, expect, mock, test } from "bun:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { PUSH_SAVE_FAILED } from "../../utils/settings-messages";
import { pushEnabledOptions } from "./push-enabled-options";

const KEY = ["push-enabled"];

function setup(save: (enabled: boolean) => Promise<void>) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(KEY, true);
  const showError = mock();
  const observer = new MutationObserver(
    queryClient,
    pushEnabledOptions(queryClient, KEY, save, showError)
  );
  return { queryClient, showError, observer };
}

describe("pushEnabledOptions", () => {
  test("muda na hora, antes da RPC responder", async () => {
    let seenBySave: unknown;
    const { queryClient, observer } = setup(async () => {
      seenBySave = queryClient.getQueryData(KEY);
    });
    await observer.mutate(false);
    expect(seenBySave).toBe(false);
  });

  test("no erro volta o valor e mostra o toast", async () => {
    const { queryClient, showError, observer } = setup(async () => {
      throw new Error("network_error");
    });
    await observer.mutate(false).catch(() => {});
    expect(queryClient.getQueryData(KEY)).toBe(true);
    expect(showError).toHaveBeenCalledWith(PUSH_SAVE_FAILED);
  });

  test("no sucesso não mostra toast", async () => {
    const { showError, observer } = setup(async () => {});
    await observer.mutate(false);
    expect(showError).not.toHaveBeenCalled();
  });
});
