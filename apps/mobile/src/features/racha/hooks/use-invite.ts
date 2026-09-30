import { useQuery } from "@tanstack/react-query";
import { INVITE_CODE_LENGTH } from "@meu-racha/domain";
import { rachaApi } from "../racha-api";

export const inviteKey = (code: string) => ["invite", code] as const;

export function useInvite(code: string) {
  return useQuery({
    queryKey: inviteKey(code),
    queryFn: () => rachaApi.getInvite(code),
    enabled: code.length === INVITE_CODE_LENGTH,
  });
}
