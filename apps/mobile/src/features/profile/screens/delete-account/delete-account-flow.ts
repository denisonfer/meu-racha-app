import type { TAccountDeletionCheck } from "../../profile-types";
import { deleteAccountLoseRachas } from "../../utils/settings-messages";

export const deleteAccountSheet = (check: TAccountDeletionCheck) =>
  check.ownedRachas.length > 0 || check.conducting.length > 0
    ? "blocked"
    : "confirm";

export const loseRachasLine = (rachaCount: number) =>
  rachaCount === 0 ? null : deleteAccountLoseRachas(rachaCount);

export type TDeleteAccountSteps = {
  removeAvatarFiles: () => Promise<void>;
  deleteMyAccount: () => Promise<void>;
  endSession: () => Promise<void>;
  clearCache: () => void;
  goToSignIn: () => void;
  showDeleted: () => void;
};

// A foto sai antes: se a função falhar, a conta fica intacta, só sem foto.
// Depois, a sessão sai antes do cache: nenhuma consulta volta com o token da
// conta apagada.
export async function deleteAccount(
  steps: TDeleteAccountSteps
): Promise<"deleted" | "blocked" | "failed"> {
  try {
    await steps.removeAvatarFiles();
    await steps.deleteMyAccount();
  } catch (error) {
    return error instanceof Error &&
      error.message === "account_deletion_blocked"
      ? "blocked"
      : "failed";
  }
  await steps.endSession();
  steps.clearCache();
  steps.goToSignIn();
  steps.showDeleted();
  return "deleted";
}
