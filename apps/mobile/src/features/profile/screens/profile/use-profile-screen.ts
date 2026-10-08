import { useSignOut } from "@/features/auth";
import { memberCardProps } from "@/features/racha";
import { useMyProfileCard } from "../../hooks/use-my-profile-card";
import { useMyProfile } from "../../hooks/use-my-profile";

export function useProfileScreen() {
  const { data: profile, isPending, refetch, isRefetching } = useMyProfile();
  const cardQuery = useMyProfileCard();
  const { signOut, isPending: isSigningOut } = useSignOut();

  const identity = profile && {
    displayName: profile.displayName,
    photoUrl: profile.photoUri,
    playsAs: profile.playsAs,
    primaryPosition: profile.primaryPosition,
  };

  // Nome e foto vêm do perfil local. A carta só traz Overall e números.
  // Sem Racha, a RPC devolve null e a carta de exemplo fica como no Cadastro.
  const card =
    identity && cardQuery.isSuccess
      ? cardQuery.data
        ? memberCardProps(
            identity,
            false,
            cardQuery.data.card,
            cardQuery.data.rachaName
          )
        : {
            ...memberCardProps(identity, false),
            context: "sem Racha ainda",
          }
      : undefined;

  return {
    card,
    isLoading: isPending || cardQuery.isPending,
    retry: () => {
      void refetch();
      void cardQuery.refetch();
    },
    isRetrying: isRefetching || cardQuery.isRefetching,
    signOut: () => signOut(),
    isSigningOut,
  };
}
