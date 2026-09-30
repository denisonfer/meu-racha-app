import { useEffect, useState } from "react";
import { queryClient } from "@/lib/query-client";
import { authApi } from "../auth-api";
import { TSession } from "../auth-types";

// um listener só para o app: cada useSession assina o seu, e o cache deve
// ser limpo uma vez por troca de dono. A abertura (ainda sem dono) não limpa.
let currentUserId: string | null | undefined;
// no redirect por sessão perdida a atual já é null: o destino é de quem a tinha
let lastUserId: string | null = null;

authApi.onSessionChange((session) => {
  const userId = session?.userId ?? null;
  if (currentUserId && currentUserId !== userId) queryClient.clear();
  currentUserId = userId;
  if (userId) lastUserId = userId;
});

export const isSignedIn = () => Boolean(currentUserId);
export const lastOwnerId = () => lastUserId;
// depois do "Sair", um convite aberto deslogado não é de ninguém
export const forgetLastOwner = () => {
  lastUserId = null;
};

export function useSession() {
  const [session, setSession] = useState<TSession | null | undefined>(
    undefined
  );

  useEffect(() => authApi.onSessionChange(setSession), []);

  return { session: session ?? null, isLoading: session === undefined };
}
