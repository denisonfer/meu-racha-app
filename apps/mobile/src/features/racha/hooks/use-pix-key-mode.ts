import { router } from "expo-router";
import { useProfileEmailVerified } from "@/features/profile";
import { TMemberRole } from "../racha-types";

// Dono com e-mail confirmado edita; sem confirmar, trava; Admin só lê.
// Enquanto o Perfil carrega (undefined) a tela edita: o banco recusa de qualquer forma
export function usePixKeyMode(role: TMemberRole) {
  const isEmailVerified = useProfileEmailVerified();
  const mode =
    role !== "OWNER"
      ? ("readonly" as const)
      : isEmailVerified === false
        ? ("locked" as const)
        : ("edit" as const);

  return {
    mode,
    openConfirmEmail: () => router.push("/profile/confirm-email"),
  };
}
