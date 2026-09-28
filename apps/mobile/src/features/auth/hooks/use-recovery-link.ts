import { useQuery } from "@tanstack/react-query";
import { authApi } from "../auth-api";

type TRecoveryLinkStatus = "checking" | "valid" | "dead" | "offline";

export function useRecoveryLink(tokenHash: string | undefined) {
  const query = useQuery({
    queryKey: ["recovery-link", tokenHash],
    queryFn: async () => {
      await authApi.verifyRecoveryLink(tokenHash!);
      return true;
    },
    enabled: Boolean(tokenHash),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const status: TRecoveryLinkStatus = !tokenHash
    ? "dead"
    : query.isPending
      ? "checking"
      : query.isSuccess
        ? "valid"
        : query.error?.message === "network_error"
          ? "offline"
          : "dead";

  return { status, retry: () => void query.refetch() };
}
