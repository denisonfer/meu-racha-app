import { dateMaskToISO } from "@meu-racha/domain";
import { supabase } from "@/lib/supabase";
import { TSignInInput, TSignUpInput } from "./auth-types";

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

  if (error) throw error;
  return data.user;
}

async function signIn(input: TSignInInput) {
  const { data, error } = await supabase.functions.invoke<{
    access_token: string;
    refresh_token: string;
  }>("sign-in", { body: input });

  if (error || !data) throw new Error("invalid_credentials");

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (sessionError) throw new Error("session_failed");
}

async function checkUsernameAvailable(username: string) {
  const { data, error } = await supabase.rpc("username_available", {
    p_username: username,
  });

  if (error) throw error;
  return data === true;
}

async function checkEmailAvailable(email: string) {
  const { data, error } = await supabase.rpc("email_available", {
    p_email: email,
  });

  if (error) throw error;
  return data === true;
}

export const authApi = {
  signUp,
  signIn,
  checkUsernameAvailable,
  checkEmailAvailable,
};
