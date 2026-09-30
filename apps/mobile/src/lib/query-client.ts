import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

// o listener padrão do focusManager é só web: no RN quem avisa é o AppState
AppState.addEventListener("change", (state) => {
  focusManager.setFocused(state === "active");
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});
