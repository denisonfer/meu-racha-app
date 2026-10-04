import type { TPlaysAs, TPosition } from "../profile/types";

// espelham o enum public.position_detail e o texto de private.position_layer
export type TPositionDetail =
  "CENTER_BACK" | "FULL_BACK" | "DEFENSIVE_MID" | "ATTACKING_MID";

export type TPositionLayer =
  | "CENTER_BACK"
  | "FULL_BACK"
  | "DEFENDER"
  | "DEFENSIVE_MID"
  | "ATTACKING_MID"
  | "MIDFIELDER"
  | "FORWARD"
  | "ANY";

// mesma ordem de private.sort_layer_ix (defesa → ataque); TODAS fica por último
export const POSITION_LAYERS = [
  "CENTER_BACK",
  "FULL_BACK",
  "DEFENDER",
  "DEFENSIVE_MID",
  "ATTACKING_MID",
  "MIDFIELDER",
  "FORWARD",
  "ANY",
] as const satisfies readonly TPositionLayer[];

export const toPositionLayer = (value: string | null): TPositionLayer | null =>
  POSITION_LAYERS.find((layer) => layer === value) ?? null;

// espelha o corte de private.position_layer e do gatilho da Solicitação
export const POSITION_DETAIL_MIN_PER_TEAM = 8;

/** Time desse tamanho divide defesa e meio-campo: a tela pergunta a subdivisão. */
export const asksPositionDetail = (outfieldPerTeam: number) =>
  outfieldPerTeam >= POSITION_DETAIL_MIN_PER_TEAM;

export const POSITION_DETAIL_LABELS: Record<TPositionDetail, string> = {
  CENTER_BACK: "Zagueiro",
  FULL_BACK: "Lateral",
  DEFENSIVE_MID: "Volante",
  ATTACKING_MID: "Meia",
};

const DETAILS_BY_ZONE: Partial<Record<TPosition, TPositionDetail[]>> = {
  DEFENDER: ["CENTER_BACK", "FULL_BACK"],
  MIDFIELDER: ["DEFENSIVE_MID", "ATTACKING_MID"],
};

/** As duas opções da zona; ATACANTE e TODAS não têm o que escolher. */
export function positionDetailOptions(
  zone: TPosition | null
): { value: TPositionDetail; label: string }[] {
  const details = zone ? (DETAILS_BY_ZONE[zone] ?? []) : [];
  return details.map((value) => ({
    value,
    label: POSITION_DETAIL_LABELS[value],
  }));
}

export const hasPositionDetail = (zone: TPosition | null) =>
  positionDetailOptions(zone).length > 0;

// espelha private.position_detail_fits
export function positionDetailFits(
  zone: TPosition | null,
  detail: TPositionDetail | null
): boolean {
  if (detail === null) return true;
  return positionDetailOptions(zone).some((option) => option.value === detail);
}

export type TLayerGroupKey = "GOALKEEPER" | TPositionLayer | "PENDING";

// Presença e cards de Time em Evento 8+. DEFENDER e MIDFIELDER só aparecem
// como camada em Time 3–7, que não agrupa por aqui; ficam para não perder ninguém.
export const LAYER_GROUPS: { key: TLayerGroupKey; label: string }[] = [
  { key: "GOALKEEPER", label: "Goleiros" },
  { key: "CENTER_BACK", label: "Zagueiros" },
  { key: "FULL_BACK", label: "Laterais" },
  { key: "DEFENDER", label: "Defensores" },
  { key: "DEFENSIVE_MID", label: "Volantes" },
  { key: "ATTACKING_MID", label: "Meias" },
  { key: "MIDFIELDER", label: "Meio-campo" },
  { key: "FORWARD", label: "Atacantes" },
  { key: "ANY", label: "Todas" },
  { key: "PENDING", label: "Posição pendente" },
];

/** A camada vem do banco; nula em jogador de linha é pendente. */
export const layerGroupKey = (person: {
  playsAs: TPlaysAs;
  primaryLayer: TPositionLayer | null;
}): TLayerGroupKey =>
  person.playsAs === "GOALKEEPER"
    ? "GOALKEEPER"
    : (person.primaryLayer ?? "PENDING");

export const isLayerPending = (person: {
  playsAs: TPlaysAs;
  primaryLayer: TPositionLayer | null;
}) => layerGroupKey(person) === "PENDING";
