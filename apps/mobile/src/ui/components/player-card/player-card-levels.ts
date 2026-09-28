import type { TCardLevel } from "@meu-racha/domain";

type TCardLevelStyle = {
  label: string;
  pips: number;
  ink: string; // overall, nome, valores
  inkSoft: string; // nome do Nível, rótulos, Racha e Temporada
  tab: string; // aba da sigla, disco da Super Estrela
  tabInk: string; // sigla, estrela, "PRO"
  pip: string; // pontos e pílula PRO
  photoBg: string;
  photoFg: string; // iniciais
  overallShadow?: string; // Monstro: cópia deslocada por baixo do overall
  overallGradient?: readonly string[]; // Lenda: overall holográfico
};

// A carta é a única superfície fora da paleta da marca (ADR); por isso as cores moram aqui
export const CARD_LEVELS: Record<TCardLevel, TCardLevelStyle> = {
  base: {
    label: "Cria da Base",
    pips: 1,
    ink: "#FFF3E4",
    inkSoft: "#F3E2CD",
    tab: "#FFF3E4",
    tabInk: "#4A2A1C",
    pip: "#FFF3E4",
    photoBg: "#6E4230",
    photoFg: "#D8AE90",
  },
  promessa: {
    label: "Promessa",
    pips: 2,
    ink: "#16202A",
    inkSoft: "#1F2A35",
    tab: "#16202A",
    tabInk: "#EEF2F6",
    pip: "#16202A",
    photoBg: "#65727F",
    photoFg: "#E3E9EF",
  },
  craque: {
    label: "Craque do Racha",
    pips: 3,
    ink: "#241703",
    inkSoft: "#2A1A06",
    tab: "#241703",
    tabInk: "#F3DFA8",
    pip: "#241703",
    photoBg: "#8F6C26",
    photoFg: "#F3E0AC",
  },
  monstro: {
    label: "Monstro",
    pips: 4,
    ink: "#FFFFFF",
    inkSoft: "#C9E9FF",
    tab: "#22E1FF",
    tabInk: "#08061A",
    pip: "#22E1FF",
    photoBg: "#241058",
    photoFg: "#7A57F0",
    overallShadow: "#FF3DDC",
  },
  lenda: {
    label: "Lenda",
    pips: 5,
    ink: "#F7F9FC",
    inkSoft: "#D6DBE6",
    tab: "#F7F9FC",
    tabInk: "#0B0B12",
    pip: "#F7F9FC",
    photoBg: "#14141F",
    photoFg: "#DDE2EC",
    overallGradient: ["#BFE9FF", "#E7C6FF", "#FFE3F1", "#FFF6C9", "#C9FFE6"],
  },
};
