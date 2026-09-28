import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import { supabase } from "@/lib/supabase";
import { TMyProfile } from "./profile-types";

async function getMyProfile(userId: string): Promise<TMyProfile> {
  const { data, error } = await supabase
    .from("profile")
    .select("display_name, avatar_path, plays_as, primary_position")
    .eq("id", userId)
    .single();
  if (error) throw error;

  return {
    displayName: data.display_name,
    playsAs: data.plays_as,
    primaryPosition: data.primary_position,
    photoUri: data.avatar_path
      ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.avatar_path).data
          .publicUrl
      : null,
  };
}

export const profileApi = { getMyProfile };
