import { describe, expect, mock, test } from "bun:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { PUSH_MUTE_FAILED } from "../utils/racha-messages";
import {
  rachaPushMutedKey,
  rachaPushMutedOptions,
} from "./racha-push-muted-options";

const RACHA = "r1";

function setup(save: (muted: boolean) => Promise<void>) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(rachaPushMutedKey(RACHA), false);
  const showError = mock();
  const observer = new MutationObserver(
    queryClient,
    rachaPushMutedOptions(queryClient, RACHA, save, showError)
  );
  return { queryClient, showError, observer };
}

describe("rachaPushMutedOptions", () => {
  test("muda na hora, antes da RPC responder", async () => {
    let seenBySave: unknown;
    const { queryClient, observer } = setup(async () => {
      seenBySave = queryClient.getQueryData(rachaPushMutedKey(RACHA));
    });
    await observer.mutate(true);
    expect(seenBySave).toBe(true);
  });

  test("no erro volta o valor e mostra o toast", async () => {
    const { queryClient, showError, observer } = setup(async () => {
      throw new Error("network_error");
    });
    await observer.mutate(true).catch(() => {});
    expect(queryClient.getQueryData(rachaPushMutedKey(RACHA))).toBe(false);
    expect(showError).toHaveBeenCalledWith(PUSH_MUTE_FAILED);
  });

  test("no sucesso não mostra toast", async () => {
    const { showError, observer } = setup(async () => {});
    await observer.mutate(true);
    expect(showError).not.toHaveBeenCalled();
  });
});
