import { router } from "expo-router";
import { useMyRachas } from "../../hooks/use-my-rachas";
import { memberCountLabel } from "../../utils/racha-labels";

export function useRachasScreen() {
  const { data, isPending, isError, refetch, isRefetching } = useMyRachas();

  return {
    rachas: (data ?? []).map((racha) => ({
      id: racha.id,
      name: racha.name,
      role: racha.role,
      membersLabel: memberCountLabel(racha.memberCount),
      // Evento só o Dono cria por enquanto; o resto vê o aviso sem botão
      canCreateEvent: racha.role === "OWNER",
    })),
    isLoading: isPending,
    isError,
    retry: () => void refetch(),
    isRetrying: isRefetching,
    createRacha: () => router.push("/racha/create"),
    openRacha: (id: string) => router.push(`/racha/${id}`),
  };
}
