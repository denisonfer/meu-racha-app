import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import { supabase } from "@/lib/supabase";
import type {
  TBlockedProfile,
  TReportKind,
  TReportReason,
} from "./moderation-types";

async function reportContent(
  kind: TReportKind,
  targetId: string,
  reason: TReportReason,
  details: string
): Promise<void> {
  const { error } = await supabase.rpc("report_content", {
    p_kind: kind,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details,
  });
  if (error) throw error;
}

async function blockProfile(profileId: string): Promise<void> {
  const { error } = await supabase.rpc("block_profile", { p_id: profileId });
  if (error) throw error;
}

async function unblockProfile(profileId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_profile", { p_id: profileId });
  if (error) throw error;
}

async function getBlockedProfiles(): Promise<TBlockedProfile[]> {
  const { data, error } = await supabase.rpc("get_blocked_profiles");
  if (error) throw error;

  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    // o tipo gerado diz not-null; sem foto e sem Racha em comum vêm null
    photoUrl: row.avatar_path
      ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(row.avatar_path).data
          .publicUrl
      : null,
    sharedRachaName: row.shared_racha_name ?? null,
  }));
}

export const moderationApi = {
  reportContent,
  blockProfile,
  unblockProfile,
  getBlockedProfiles,
};
