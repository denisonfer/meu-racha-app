import { USERNAME_PATTERN } from "@meu-racha/domain";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { authApi } from "../auth-api";

export const usernameAvailableQuery = (username: string) =>
  queryOptions({
    queryKey: ["username-available", username] as const,
    queryFn: () => authApi.isUsernameAvailable(username),
    staleTime: 60_000,
    retry: false,
  });

export function useUsernameAvailable(username: string) {
  const hasValidFormat = USERNAME_PATTERN.test(username);

  const query = useQuery({
    ...usernameAvailableQuery(username),
    enabled: hasValidFormat,
  });

  return {
    isChecking: hasValidFormat && query.isFetching,
    isAvailable: query.data ?? null,
  };
}
