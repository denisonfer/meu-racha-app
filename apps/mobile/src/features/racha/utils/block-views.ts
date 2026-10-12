import type { QueryClient } from "@tanstack/react-query";

// O bloqueio vale em todos os Rachas: recarrega as três leituras que escondem a pessoa.
export function invalidateBlockViews(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["racha-members"] });
  void queryClient.invalidateQueries({ queryKey: ["season-ranking"] });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "racha" && query.queryKey[4] === "resenha",
  });
}
