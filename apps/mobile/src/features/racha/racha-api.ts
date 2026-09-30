import type { PostgrestError } from "@supabase/supabase-js";
import { normalizeInviteCode, type TRachaRules } from "@meu-racha/domain";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import {
  TCreatedRacha,
  TInvite,
  TInviteStatus,
  TJoinRequest,
  TMyJoinRequest,
  TMemberUpdate,
  TMyRacha,
  TRacha,
  TRachaMember,
  TRachaNotice,
  TRachaSettings,
} from "./racha-types";

// raise exception chega na message, não no code
const RAISE_EXCEPTION_CODES = [
  "plan_owner_limit",
  "already_resolved",
  "not_allowed",
  "stars_required",
  "not_member",
  "admin_limit",
  "owner_cannot_leave",
];

// status 0 = o pedido nem chegou ao servidor; o resto vira o código do banco
function toCodedError(error: PostgrestError, status: number): Error {
  if (status === 0) return new Error("network_error");
  if (RAISE_EXCEPTION_CODES.includes(error.message))
    return new Error(error.message);
  return new Error(error.code || error.message);
}

function toPhotoUrl(avatarPath: string | null): string | null {
  return avatarPath
    ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath).data
        .publicUrl
    : null;
}

function toInviteStatus(value: string | null): TInviteStatus | null {
  return value === "MEMBER" || value === "PENDING" ? value : null;
}

async function createRacha(
  name: string,
  rules: TRachaRules,
  minAge: number | null
): Promise<TCreatedRacha> {
  const { data, error, status } = await supabase.rpc("create_racha", {
    p_name: name,
    p_outfield_per_team: rules.outfieldPerTeam,
    p_game_mode: rules.gameMode,
    p_max_consecutive_wins: rules.maxConsecutiveWins,
    p_tie_rule: rules.tieRule,
    p_tie_return_order: rules.tieReturnOrder,
    p_consider_position: rules.considerPosition,
    ...(rules.matchDurationMin === null
      ? {}
      : { p_match_duration_min: rules.matchDurationMin }),
    ...(minAge === null ? {} : { p_min_age: minAge }),
  });
  if (error) throw toCodedError(error, status);

  const created = data[0];
  if (!created) throw new Error("create_racha_empty");
  return { id: created.id, inviteCode: created.invite_code };
}

async function listMyRachas(userId: string): Promise<TMyRacha[]> {
  const { data, error, status } = await supabase
    .from("member")
    .select("role, racha(id, name, member(count), join_request(count))")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .eq("racha.member.is_active", true)
    .eq("racha.join_request.status", "PENDING")
    .order("joined_at");
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    id: row.racha.id,
    name: row.racha.name,
    role: row.role,
    memberCount: row.racha.member[0]?.count ?? 0,
    pendingCount: row.racha.join_request[0]?.count ?? 0,
  }));
}

async function getRacha(id: string, userId: string): Promise<TRacha> {
  const { data, error, status } = await supabase
    .from("racha")
    .select(
      "id, name, invite_code, outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position, match_duration_min, min_age, members:member(count), me:member(role), pending:join_request(count)"
    )
    .eq("id", id)
    .eq("members.is_active", true)
    .eq("me.profile_id", userId)
    .eq("pending.status", "PENDING")
    .single();
  if (error) throw toCodedError(error, status);

  const me = data.me[0];

  if (!me) throw new Error("not_a_member");

  return {
    id: data.id,
    name: data.name,
    inviteCode: data.invite_code,
    role: me.role,
    memberCount: data.members[0]?.count ?? 0,
    pendingCount: data.pending[0]?.count ?? 0,
    minAge: data.min_age,
    rules: {
      outfieldPerTeam: data.outfield_per_team,
      gameMode: data.game_mode,
      maxConsecutiveWins: data.max_consecutive_wins,
      tieRule: data.tie_rule,
      tieReturnOrder: data.tie_return_order,
      considerPosition: data.consider_position,
      matchDurationMin: data.match_duration_min,
    },
  };
}

async function getInvite(code: string): Promise<TInvite | null> {
  const { data, error, status } = await supabase.rpc("get_invite", {
    p_code: normalizeInviteCode(code),
  });
  if (error) throw toCodedError(error, status);

  const row = data[0];
  if (!row) return null;

  return {
    rachaId: row.racha_id,
    name: row.name,
    memberCount: row.member_count,
    ownerName: row.owner_name,
    // o tipo gerado diz not-null, mas min_age e my_status vêm null
    minAge: row.min_age ?? null,
    myStatus: toInviteStatus(row.my_status),
  };
}

async function requestJoin(rachaId: string): Promise<void> {
  const { error, status } = await supabase
    .from("join_request")
    .insert({ racha_id: rachaId });
  if (error) {
    if (error.code === "23505") throw new Error("already_requested");
    throw toCodedError(error, status);
  }
}

async function cancelJoinRequest(rachaId: string): Promise<void> {
  const { data, error, status } = await supabase
    .from("join_request")
    .delete()
    .eq("racha_id", rachaId)
    .select("id");
  if (error) throw toCodedError(error, status);
  // a RLS só apaga pedido pendente: 0 linhas = já não estava pendente
  if (data.length === 0) throw new Error("join_request_not_pending");
}

async function listMyJoinRequests(): Promise<TMyJoinRequest[]> {
  const { data, error, status } = await supabase.rpc("list_my_join_requests");
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    rachaId: row.racha_id,
    rachaName: row.racha_name,
  }));
}

async function listJoinRequests(rachaId: string): Promise<TJoinRequest[]> {
  const { data, error, status } = await supabase.rpc("list_join_requests", {
    p_racha_id: rachaId,
  });
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    photoUrl: toPhotoUrl(row.avatar_path),
    age: row.age,
    // o tipo gerado diz not-null; o Goleiro vem sem posição
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    playsAs: row.plays_as,
  }));
}

async function approveJoinRequest(
  requestId: string,
  stars: number | null,
  isSuperStar: boolean
): Promise<void> {
  const { error, status } = await supabase.rpc("approve_join_request", {
    p_request_id: requestId,
    // null pro Goleiro; o tipo gerado diz number
    p_stars: stars as number,
    p_super_star: isSuperStar,
  });
  if (error) throw toCodedError(error, status);
}

async function refuseJoinRequest(requestId: string): Promise<void> {
  const { error, status } = await supabase.rpc("refuse_join_request", {
    p_request_id: requestId,
  });
  if (error) throw toCodedError(error, status);
}

async function listRachaMembers(rachaId: string): Promise<TRachaMember[]> {
  const { data, error, status } = await supabase.rpc("list_racha_members", {
    p_racha_id: rachaId,
  });
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    photoUrl: toPhotoUrl(row.avatar_path),
    role: row.role,
    playsAs: row.plays_as,
    // o tipo gerado diz not-null; o Goleiro vem sem posição e sem Estrelas
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    stars: row.stars,
    isSuperStar: row.is_super_star,
  }));
}

async function updateRacha(
  id: string,
  settings: TRachaSettings
): Promise<void> {
  const { data, error, status } = await supabase
    .from("racha")
    .update({
      name: settings.name,
      min_age: settings.minAge,
      outfield_per_team: settings.rules.outfieldPerTeam,
      game_mode: settings.rules.gameMode,
      max_consecutive_wins: settings.rules.maxConsecutiveWins,
      tie_rule: settings.rules.tieRule,
      tie_return_order: settings.rules.tieReturnOrder,
      consider_position: settings.rules.considerPosition,
      match_duration_min: settings.rules.matchDurationMin,
    })
    .eq("id", id)
    .select("id");
  if (error) throw toCodedError(error, status);
  // a RLS filtra quem não é Dono: 0 linhas, sem erro
  if (data.length === 0) throw new Error("not_allowed");
}

async function deleteRacha(id: string): Promise<void> {
  const { data, error, status } = await supabase
    .from("racha")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw toCodedError(error, status);
  if (data.length === 0) throw new Error("not_allowed");
}

async function updateMember(
  rachaId: string,
  profileId: string,
  update: TMemberUpdate
): Promise<void> {
  const { error, status } = await supabase.rpc("update_member", {
    p_racha_id: rachaId,
    p_profile_id: profileId,
    // null pro Goleiro; o tipo gerado diz number
    p_stars: update.stars as number,
    p_super_star: update.isSuperStar,
    p_role: update.role,
  });
  if (error) throw toCodedError(error, status);
}

async function expelMember(rachaId: string, profileId: string): Promise<void> {
  const { error, status } = await supabase.rpc("expel_member", {
    p_racha_id: rachaId,
    p_profile_id: profileId,
  });
  if (error) throw toCodedError(error, status);
}

async function leaveRacha(rachaId: string): Promise<void> {
  const { error, status } = await supabase.rpc("leave_racha", {
    p_racha_id: rachaId,
  });
  if (error) throw toCodedError(error, status);
}

async function listRachaNotices(): Promise<TRachaNotice[]> {
  const { data, error, status } = await supabase
    .from("racha_notice")
    .select("id, racha_name, kind")
    .order("created_at", { ascending: false });
  if (error) throw toCodedError(error, status);
  return data.map((row) => ({
    id: row.id,
    rachaName: row.racha_name,
    kind: row.kind,
  }));
}

async function dismissRachaNotice(id: string): Promise<void> {
  const { error, status } = await supabase
    .from("racha_notice")
    .delete()
    .eq("id", id);
  if (error) throw toCodedError(error, status);
}

export const rachaApi = {
  createRacha,
  listMyRachas,
  getRacha,
  getInvite,
  requestJoin,
  cancelJoinRequest,
  listMyJoinRequests,
  listJoinRequests,
  approveJoinRequest,
  refuseJoinRequest,
  listRachaMembers,
  updateMember,
  expelMember,
  leaveRacha,
  listRachaNotices,
  dismissRachaNotice,
  updateRacha,
  deleteRacha,
};
