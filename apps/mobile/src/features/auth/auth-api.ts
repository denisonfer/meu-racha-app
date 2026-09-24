import { supabase } from "@/lib/supabase";
import { TSignUpInput } from "./auth-types";

function signUpErrorMessage(raw: string): string {
  if (raw.includes("under_minimum_age"))
    return "É preciso ter 16 anos ou mais.";
  if (raw.includes("profile_username_key"))
    return "Esse username já está em uso.";
  if (raw.includes("already registered")) return "Esse e-mail já tem conta.";
  return "Não foi possível criar a conta. Tente de novo.";
}

async function signUp(input: TSignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        username: input.username,
        display_name: input.displayName,
        birth_date: input.birthDate,
        plays_as: input.playsAs,
        primary_position: input.primaryPosition,
        secondary_position: input.secondaryPosition,
      },
    },
  });

  if (error) throw new Error(signUpErrorMessage(error.message));
  return data.user;
}

export const authApi = {
  signUp,
};
