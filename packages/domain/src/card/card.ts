import { TPlaysAs, TPosition } from "../profile/types";

export type TCardLevel = "base" | "promessa" | "craque" | "monstro" | "lenda";
export type TRoleBadge = "DEF" | "MEI" | "ATA" | "TODAS" | "GOL";

// todo mundo começa aqui: é o piso da Temporada e o overall das 5 primeiras Partidas
export const OVERALL_MIN = 40;

const NAME_MAX = 14;
const NAME_SHRINK_AFTER = 11;

export const LEVEL_NAME: Record<TCardLevel, string> = {
  base: "Cria da Base",
  promessa: "Promessa",
  craque: "Craque do Racha",
  monstro: "Monstro",
  lenda: "Lenda",
};

export function levelFromOverall(overall: number): TCardLevel {
  if (overall >= 99) return "lenda";
  if (overall >= 90) return "monstro";
  if (overall >= 75) return "craque";
  if (overall >= 60) return "promessa";
  return "base";
}

const POSITION_BADGE: Record<TPosition, TRoleBadge> = {
  ANY: "TODAS",
  DEFENDER: "DEF",
  MIDFIELDER: "MEI",
  FORWARD: "ATA",
};

export function roleBadge(
  playsAs: TPlaysAs,
  position: TPosition | null
): TRoleBadge | null {
  if (playsAs === "GOALKEEPER") return "GOL";
  return position ? POSITION_BADGE[position] : null;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  // Array.from anda por caractere, não por unidade UTF-16
  const first = Array.from(words[0] ?? "");
  const last = Array.from(words.at(-1) ?? "");
  const pair =
    words.length > 1
      ? first.slice(0, 1).join("") + last.slice(0, 1).join("")
      : first.slice(0, 2).join("");

  return pair.toLocaleUpperCase("pt-BR");
}

// regra do design system: 28; 24 acima de 11 caracteres; corta com "…" acima de 14
export function cardNameFit(name: string): { text: string; fontSize: 28 | 24 } {
  const chars = Array.from(name.trim().toLocaleUpperCase("pt-BR"));
  const fontSize = chars.length > NAME_SHRINK_AFTER ? 24 : 28;

  if (chars.length <= NAME_MAX) return { text: chars.join(""), fontSize };

  const cut = chars
    .slice(0, NAME_MAX - 1)
    .join("")
    .trimEnd();
  return { text: `${cut}…`, fontSize };
}
