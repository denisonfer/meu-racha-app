import { describe, expect, mock, test } from "bun:test";
import type { TAccountDeletionCheck } from "../../profile-types";
import {
  deleteAccount,
  deleteAccountSheet,
  loseRachasLine,
  type TDeleteAccountSteps,
} from "./delete-account-flow";

const check = (
  over: Partial<TAccountDeletionCheck> = {}
): TAccountDeletionCheck => ({
  rachaCount: 2,
  ownedRachas: [],
  conducting: [],
  ...over,
});
const OWNED = [{ id: "r1", name: "Racha da Firma", memberCount: 9 }];
const CONDUCTING = [{ rachaId: "r2", rachaName: "Pelada", eventId: "e1" }];

describe("deleteAccountSheet", () => {
  test("sem Dono nem condução, confirma; mesmo sem Racha", () => {
    expect(deleteAccountSheet(check())).toBe("confirm");
    expect(deleteAccountSheet(check({ rachaCount: 0 }))).toBe("confirm");
  });

  test("Dono, Condutor ou os dois bloqueiam", () => {
    expect(deleteAccountSheet(check({ ownedRachas: OWNED }))).toBe("blocked");
    expect(deleteAccountSheet(check({ conducting: CONDUCTING }))).toBe(
      "blocked"
    );
    expect(
      deleteAccountSheet(check({ ownedRachas: OWNED, conducting: CONDUCTING }))
    ).toBe("blocked");
  });
});

describe("loseRachasLine", () => {
  test("sai com 0, singular com 1, número com N", () => {
    expect(loseRachasLine(0)).toBeNull();
    expect(loseRachasLine(1)).toBe("Seu lugar no racha em que você está");
    expect(loseRachasLine(3)).toBe("Seu lugar nos 3 rachas em que você está");
  });
});

function steps(over: Partial<TDeleteAccountSteps> = {}) {
  const calls: string[] = [];
  const track = (name: string) =>
    mock(async () => {
      calls.push(name);
    });
  const all: TDeleteAccountSteps = {
    removeAvatarFiles: track("removeAvatarFiles"),
    deleteMyAccount: track("deleteMyAccount"),
    endSession: track("endSession"),
    clearCache: track("clearCache"),
    goToSignIn: track("goToSignIn"),
    showDeleted: track("showDeleted"),
    ...over,
  };
  return { all, calls };
}

describe("deleteAccount", () => {
  test("sucesso: foto, conta, sessão, cache, Entrar e o toast, nessa ordem", async () => {
    const { all, calls } = steps();
    expect(await deleteAccount(all)).toBe("deleted");
    expect(calls).toEqual([
      "removeAvatarFiles",
      "deleteMyAccount",
      "endSession",
      "clearCache",
      "goToSignIn",
      "showDeleted",
    ]);
  });

  test("account_deletion_blocked não sai da conta", async () => {
    const { all, calls } = steps({
      deleteMyAccount: async () => {
        throw new Error("account_deletion_blocked");
      },
    });
    expect(await deleteAccount(all)).toBe("blocked");
    expect(calls).toEqual(["removeAvatarFiles"]);
  });

  test("outro erro vira falha, sem sair da conta", async () => {
    const { all, calls } = steps({
      deleteMyAccount: async () => {
        throw new Error("network_error");
      },
    });
    expect(await deleteAccount(all)).toBe("failed");
    expect(calls).toEqual(["removeAvatarFiles"]);
  });

  test("falha ao apagar a foto não chama a função do banco", async () => {
    const { all, calls } = steps({
      removeAvatarFiles: async () => {
        throw new Error("network_error");
      },
    });
    expect(await deleteAccount(all)).toBe("failed");
    expect(calls).toEqual([]);
  });
});
