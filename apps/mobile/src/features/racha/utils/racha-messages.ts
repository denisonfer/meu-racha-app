import {
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  RACHA_NAME_MIN,
} from "@meu-racha/domain";

/**
 * Todo pt-BR de erro do Racha mora aqui; a api fala em código, a tela fala em
 * português.
 */
export const NAME_REQUIRED =
  "Falta o nome do racha. Digite um nome para criar.";
export const NAME_TOO_SHORT = `Mínimo de ${RACHA_NAME_MIN} caracteres.`;
export const NAME_INVALID = "Use letras e números, começando por letra.";
export const MATCH_DURATION_INVALID = `De ${MATCH_DURATION_MIN} a ${MATCH_DURATION_MAX} minutos, ou Sem relógio.`;

export const PLAN_OWNER_LIMIT =
  "No plano grátis você pode ser dono de 1 racha. O Pro chega em breve.";

export const CREATE_RACHA_FAILED =
  "Não criou o racha. Toque em Criar racha para tentar de novo.";

export const isPlanOwnerLimit = (code: string | null) =>
  code === "plan_owner_limit";
