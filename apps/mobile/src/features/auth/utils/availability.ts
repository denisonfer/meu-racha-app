import { USERNAME_PATTERN } from "@meu-racha/domain";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { authApi } from "../auth-api";

const normalize = (value: string) => value.trim().toLowerCase();

const checks = {
  username: {
    isAskable: (value: string) => USERNAME_PATTERN.test(value),
    ask: authApi.checkUsernameAvailable,
    takenMessage: "Esse username já está em uso",
  },
  email: {
    isAskable: (value: string) => z.email().safeParse(value).success,
    ask: authApi.checkEmailAvailable,
    takenMessage: "Esse e-mail já tem conta",
  },
} as const;

export type TAvailabilityField = keyof typeof checks;

const isAvailabilityField = (field: string): field is TAvailabilityField =>
  field in checks;

export const isAskable = (field: TAvailabilityField, value: string) =>
  checks[field].isAskable(normalize(value));

export const availabilityQuery = (field: TAvailabilityField, value: string) => {
  const normalized = normalize(value);

  return queryOptions({
    queryKey: ["availability", field, normalized] as const,
    queryFn: () => checks[field].ask(normalized),
    retry: false,
  });
};

export async function findTakenFields(
  queryClient: QueryClient,
  fields: readonly string[],
  readValue: (field: TAvailabilityField) => string
) {
  const answers = await Promise.all(
    fields.filter(isAvailabilityField).map(async (field) => ({
      field,
      message: checks[field].takenMessage,
      isFree: await queryClient
        .query(availabilityQuery(field, readValue(field)))
        .catch(() => true),
    }))
  );

  return answers
    .filter((answer) => !answer.isFree)
    .map(({ field, message }) => ({ field, message }));
}
