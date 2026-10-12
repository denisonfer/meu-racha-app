import { describe, expect, mock, test } from "bun:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import type { TBlockedProfile } from "../moderation-types";
import { UNBLOCK_FAILED } from "../utils/moderation-messages";
import { unblockOptions } from "./unblock-options";

const KEY = ["blocked-profiles"];

const CARLOS: TBlockedProfile = {
  profileId: "c",
  displayName: "Carlos Mendes",
  photoUrl: null,
  sharedRachaName: "Racha da Quadra",
};
const ANA: TBlockedProfile = {
  profileId: "a",
  displayName: "Ana Paula",
  photoUrl: null,
  sharedRachaName: null,
};

function setup(unblock: (profileId: string) => Promise<void>) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  queryClient.setQueryData(KEY, [CARLOS, ANA]);
  const showToast = mock();
  const invalidateViews = mock();
  const observer = new MutationObserver(
    queryClient,
    unblockOptions(queryClient, KEY, unblock, showToast, invalidateViews)
  );
  return { queryClient, showToast, invalidateViews, observer };
}

const ids = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<TBlockedProfile[]>(KEY)
    ?.map((person) => person.profileId);

describe("unblockOptions", () => {
  test("tira a pessoa da lista antes da RPC responder", async () => {
    let seenByRpc: string[] | undefined;
    const { queryClient, observer } = setup(async () => {
      seenByRpc = ids(queryClient);
    });
    await observer.mutate(CARLOS);
    expect(seenByRpc).toEqual(["a"]);
  });

  test("no sucesso avisa com o nome e recarrega as telas que escondem", async () => {
    const { showToast, invalidateViews, observer } = setup(async () => {});
    await observer.mutate(CARLOS);
    expect(showToast).toHaveBeenCalledWith(
      "Carlos Mendes desbloqueado.",
      "success"
    );
    expect(invalidateViews).toHaveBeenCalled();
  });

  test("no erro a pessoa volta para a lista e mostra o toast", async () => {
    const { queryClient, showToast, observer } = setup(async () => {
      throw new Error("network_error");
    });
    await observer.mutate(CARLOS).catch(() => {});
    expect(ids(queryClient)).toEqual(["c", "a"]);
    expect(showToast).toHaveBeenCalledWith(UNBLOCK_FAILED, "danger");
  });
});
