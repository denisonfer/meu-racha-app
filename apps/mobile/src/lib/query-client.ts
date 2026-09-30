import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

// o listener padrão do focusManager é só web: no RN quem avisa é o AppState
AppState.addEventListener("change", (state) => {
  focusManager.setFocused(state === "active");
});

// sem acesso não volta tentando de novo (códigos de features/racha/utils/no-access.ts)
const NO_RETRY_CODES = ["PGRST116", "not_a_member", "not_allowed"];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !NO_RETRY_CODES.includes(error.message) && failureCount < 2,
    },
  },
});
