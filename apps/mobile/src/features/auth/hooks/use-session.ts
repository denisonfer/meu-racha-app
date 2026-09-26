import { useEffect, useState } from "react";
import { authApi } from "../auth-api";
import { TSession } from "../auth-types";

export function useSession() {
  const [session, setSession] = useState<TSession | null | undefined>(
    undefined
  );

  useEffect(() => authApi.onSessionChange(setSession), []);

  return { session: session ?? null, isLoading: session === undefined };
}
