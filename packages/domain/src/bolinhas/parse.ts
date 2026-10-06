import {
  parsePublishedSort,
  parseSortPerson,
  SORT_PAYLOAD_INVALID,
  type TPhotoResolver,
} from "../sorteio/parse";
import type { TBolinhasPick, TDrawnBolinhas } from "./types";

const invalid = () => new Error(SORT_PAYLOAD_INVALID);

type TObject = Record<string, unknown>;

function obj(value: unknown): TObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as TObject;
  }
  throw invalid();
}

function pick(value: unknown, photo: TPhotoResolver): TBolinhasPick {
  const raw = obj(value);
  const color = raw.color;
  if (color !== "blue" && color !== "red") throw invalid();
  if (typeof raw.person_id !== "string") throw invalid();
  return { ...parseSortPerson(raw, photo), personId: raw.person_id, color };
}

/** Retorno de draw_event_bolinhas. Formato inesperado vira erro de código. */
export function parseDrawnBolinhas(
  json: unknown,
  photo: TPhotoResolver
): TDrawnBolinhas {
  const raw = obj(json);
  if (typeof raw.bolinhas_id !== "string") throw invalid();
  if (typeof raw.all_move !== "boolean") throw invalid();
  if (!Array.isArray(raw.order)) throw invalid();
  const published = parsePublishedSort(raw.published, photo);
  if (published.state !== "published") throw invalid();
  return {
    bolinhasId: raw.bolinhas_id,
    allMove: raw.all_move,
    order: raw.order.map((item) => pick(item, photo)),
    published,
  };
}
