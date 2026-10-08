import { useQuery } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";

export { cardOverall } from "../utils/member-card";

export const rachaCardsKey = (rachaId: string) =>
  ["racha-cards", rachaId] as const;

// A carta do Perfil não pertence a um Racha da tela: o banco escolhe qual.
// A key fica aqui para o encerramento invalidar sem o Racha importar o Perfil.
export const myProfileCardKey = ["my-profile-card"] as const;

export function loadMyProfileCard() {
  return rachaApi.getMyProfileCard();
}

export function useRachaCards(rachaId: string) {
  return useQuery({
    queryKey: rachaCardsKey(rachaId),
    queryFn: async () => {
      const cards = await rachaApi.getRachaCards(rachaId);
      return new Map(cards.map((card) => [card.profileId, card]));
    },
    enabled: Boolean(rachaId),
  });
}
