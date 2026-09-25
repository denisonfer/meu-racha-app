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

/**
 * Login por username.
 *
 * O Supabase Auth só aceita e-mail; quem traduz username -> e-mail é a Edge
 * Function, no servidor. Aqui só entregamos os tokens ao client, que passa a
 * cuidar da sessão (refresh, persistência) como em qualquer login normal.
 */
async function signIn(input: TSignInInput) {
  const { data, error } = await supabase.functions.invoke<{
    access_token: string;
    refresh_token: string;
  }>("sign-in", { body: input });

  // Erro de rede ou 401 da função: mensagem única, igual à do servidor.
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
};
