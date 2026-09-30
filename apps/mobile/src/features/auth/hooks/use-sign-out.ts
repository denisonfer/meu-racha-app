import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { setSigningOut } from "../utils/pending-destination";
import { forgetLastOwner, isSignedIn } from "./use-session";

export function useSignOut() {
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      setSigningOut(true);
      try {
        await authApi.signOut();
      } catch (error) {
        // sem rede o auth-js apaga a sessão local mesmo assim: neste aparelho, saiu
        if (isSignedIn()) throw error;
      }
      forgetLastOwner();
    },
    onError: () => {
      setSigningOut(false);
      showToast("Não foi possível sair. Tente de novo.");
    },
  });

  return { signOut: mutation.mutate, isPending: mutation.isPending };
}
