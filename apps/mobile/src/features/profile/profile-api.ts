import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import { supabase } from "@/lib/supabase";
import { TAccountDeletionCheck, TMyProfile } from "./profile-types";

async function getMyProfile(userId: string): Promise<TMyProfile> {
  const { data, error } = await supabase
    .from("profile")
    .select(
      "display_name, avatar_path, plays_as, primary_position, email_verified_at"
    )
    .eq("id", userId)
    .single();
  if (error) throw error;

  return {
    displayName: data.display_name,
    playsAs: data.plays_as,
    primaryPosition: data.primary_position,
    isEmailVerified: data.email_verified_at !== null,
    photoUri: data.avatar_path
      ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.avatar_path).data
          .publicUrl
      : null,
  };
}

type TCheckRow = {
  racha_count: number;
  owned_rachas: { id: string; name: string; member_count: number }[];
  conducting: { racha_id: string; racha_name: string; event_id: string }[];
};

async function getAccountDeletionCheck(): Promise<TAccountDeletionCheck> {
  const { data, error } = await supabase.rpc("get_account_deletion_check");
  if (error) throw error;

  const row = data as unknown as TCheckRow;
  return {
    rachaCount: row.racha_count,
    ownedRachas: row.owned_rachas.map((r) => ({
      id: r.id,
      name: r.name,
      memberCount: r.member_count,
    })),
    conducting: row.conducting.map((c) => ({
      rachaId: c.racha_id,
      rachaName: c.racha_name,
      eventId: c.event_id,
    })),
  };
}

// O banco não apaga arquivo do armazenamento: a foto sai pela API antes da conta.
async function removeMyAvatarFiles(userId: string) {
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  // a lista vem em páginas de 100; cada troca de foto deixa um arquivo
  for (;;) {
    const { data, error } = await bucket.list(userId);
    if (error) throw error;
    if (data.length === 0) return;
    const removed = await bucket.remove(
      data.map((file) => `${userId}/${file.name}`)
    );
    if (removed.error) throw removed.error;
    // a policy recusa em silêncio: sem isto a lista voltaria igual para sempre
    if (removed.data.length === 0) throw new Error("avatar_not_removed");
  }
}

async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error?.message === "account_deletion_blocked")
    throw new Error("account_deletion_blocked");
  if (error) throw error;
}

// shouldCreateUser: false — a conta já existe; sem isso o OTP poderia criar outra
async function sendEmailCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
}

// separada do verifyOtp: o código é de uso único, então a falha aqui se repete só a RPC.
// Ela só aceita sessão aberta por código (amr otp), que o verifyOtp acabou de abrir
async function confirmEmailVerified() {
  const { error } = await supabase.rpc("confirm_email_verified");
  if (error) throw error;
}

export const profileApi = {
  sendEmailCode,
  verifyEmailCode,
  confirmEmailVerified,
  getMyProfile,
  getAccountDeletionCheck,
  removeMyAvatarFiles,
  deleteMyAccount,
};
