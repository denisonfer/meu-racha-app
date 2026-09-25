import { dateMaskToISO } from "@meu-racha/domain";
import { supabase } from "@/lib/supabase";
import { TSignInInput, TSignUpInput } from "./auth-types";

function signUpErrorMessage(raw: string): string {
  if (raw.includes("under_minimum_age"))
    return "É preciso ter 16 anos ou mais.";
  if (raw.includes("profile_username_key"))
    return "Esse username já está em uso.";
  if (raw.includes("already registered")) return "Esse e-mail já tem conta.";
  return "Não foi possível criar a conta. Tente de novo.";
}

/**
 * Só para a experiência: avisa cedo em vez de deixar a pessoa descobrir no fim.
 * A garantia continua sendo a constraint unique do banco — entre esta consulta
 * e o cadastro existe uma janela em que outra pessoa pode pegar o mesmo nome.
 */
async function isUsernameAvailable(username: string) {
  const { data, error } = await supabase.rpc("username_available", {
    p_username: username,
  });

  if (error) throw new Error("Não foi possível verificar o username.");
  return data === true;
}

async function signUp(input: TSignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        username: input.username,
        display_name: input.displayName,
        birth_date: dateMaskToISO(input.birthDate) ?? input.birthDate,
        plays_as: input.playsAs,
        primary_position: input.primaryPosition,
        secondary_position: input.secondaryPosition,
      },
    },
  });

  if (error) throw new Error(signUpErrorMessage(error.message));
  return data.user;
}

async function signIn(input: TSignInInput) {
  const { data, error } = await supabase.functions.invoke<{
    access_token: string;
    refresh_token: string;
  }>("sign-in", { body: input });

  if (error || !data) throw new Error("Usuário ou senha inválidos.");

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (sessionError) throw new Error("Não foi possível entrar. Tente de novo.");
}

export const authApi = {
  signUp,
  signIn,
  isUsernameAvailable,
};
