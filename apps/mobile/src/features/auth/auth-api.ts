import type { Session } from "@supabase/supabase-js";
import { dateMaskToISO } from "@meu-racha/domain";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TSession, TSignInInput, TSignUpInput } from "./auth-types";

async function signUp(input: TSignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
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
  const { error } = await supabase.auth.signInWithPassword(input);

  if (isAuthRetryableFetchError(error)) throw new Error("network_error");
  if (error) throw error;
}

async function checkEmailAvailable(email: string) {
  const { data, error } = await supabase.rpc("email_available", {
    p_email: email,
  });

  if (error) throw error;
  return data === true;
}

const toSession = (session: Session | null): TSession | null =>
  session ? { userId: session.user.id, email: session.user.email ?? "" } : null;

function onSessionChange(listener: (session: TSession | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    listener(toSession(session))
  );

  return () => data.subscription.unsubscribe();
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const authApi = {
  signUp,
  signIn,
  checkEmailAvailable,
  onSessionChange,
  signOut,
};
