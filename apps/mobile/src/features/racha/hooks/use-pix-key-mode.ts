import { router } from "expo-router";
import { useMyProfile } from "@/features/profile";
import { TMemberRole } from "../racha-types";

// Dono com e-mail confirmado edita; sem confirmar, trava; Admin só lê.
// Enquanto o Perfil carrega (undefined) a tela edita: o banco recusa de qualquer forma
export function usePixKeyMode(role: TMemberRole) {
  const profile = useMyProfile().data;
  const mode =
    role !== "OWNER"
      ? ("readonly" as const)
      : profile?.isEmailVerified === false
        ? ("locked" as const)
        : ("edit" as const);

  return {
    mode,
    // quem edita é o Dono: o nome dele preenche o titular quando não há um salvo
    ownerName: profile?.displayName ?? "",
    openConfirmEmail: () => router.push("/profile/confirm-email"),
  };
}
