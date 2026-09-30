import type { AuthError, Session } from "@supabase/supabase-js";
import { dateMaskToISO } from "@meu-racha/domain";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { TPickedImage } from "@/lib/image-picker";
import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import { supabase } from "@/lib/supabase";
import { TSession, TSignInInput, TSignUpInput } from "./auth-types";

async function signUp(input: Omit<TSignUpInput, "photo">) {
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
        // o gatilho do banco recusa a conta sem este aceite
        terms_accepted: true,
      },
    },
  });

  if (error) throw error;
  return data.user;
}

async function uploadAvatar(userId: string, image: TPickedImage) {
  const path = `${userId}/${Date.now()}.jpg`;
  const body = await (await fetch(image.uri)).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType: image.mimeType });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from("profile")
    .update({ avatar_path: path })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) throw error;
}

async function signIn(input: TSignInInput) {
  const { error } = await supabase.auth.signInWithPassword(input);

  if (isAuthRetryableFetchError(error) || (error?.status ?? 0) >= 500)
    throw new Error("network_error");
  if (error) throw toCodedError(error);
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

function toCodedError(error: AuthError): Error {
  if (isAuthRetryableFetchError(error)) return new Error("network_error");
  return new Error(error.code ?? error.message);
}

async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error?.code === "over_email_send_rate_limit") return;
  if (error) throw toCodedError(error);
}

async function verifyRecoveryLink(tokenHash: string) {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) throw toCodedError(error);
}

async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw toCodedError(error);
}

async function signOutOtherSessions() {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw toCodedError(error);
}

export const authApi = {
  signUp,
  uploadAvatar,
  signIn,
  checkEmailAvailable,
  onSessionChange,
  signOut,
  requestPasswordReset,
  verifyRecoveryLink,
  changePassword,
  signOutOtherSessions,
};
