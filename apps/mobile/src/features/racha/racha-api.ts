import type { PostgrestError } from "@supabase/supabase-js";
import type { TRachaRules } from "@meu-racha/domain";
import { supabase } from "@/lib/supabase";
import { TCreatedRacha, TMyRacha, TRacha } from "./racha-types";

// status 0 = o pedido nem chegou ao servidor; o resto vira o código do banco
// (plan_owner_limit vem como message de um raise exception)
function toCodedError(error: PostgrestError, status: number): Error {
  if (status === 0) return new Error("network_error");
  if (error.message === "plan_owner_limit") return new Error(error.message);
  return new Error(error.code || error.message);
}

async function createRacha(
  name: string,
  rules: TRachaRules
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
  });
  if (error) throw toCodedError(error, status);

  const created = data[0];
  if (!created) throw new Error("create_racha_empty");
  return { id: created.id, inviteCode: created.invite_code };
}

async function listMyRachas(userId: string): Promise<TMyRacha[]> {
  const { data, error, status } = await supabase
    .from("member")
    .select("role, racha(id, name, member(count))")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .eq("racha.member.is_active", true)
    .order("joined_at");
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    id: row.racha.id,
    name: row.racha.name,
    role: row.role,
    memberCount: row.racha.member[0]?.count ?? 0,
  }));
}

async function getRacha(id: string, userId: string): Promise<TRacha> {
  const { data, error, status } = await supabase
    .from("racha")
    .select(
      "id, name, invite_code, outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position, match_duration_min, members:member(count), me:member(role)"
    )
    .eq("id", id)
    .eq("members.is_active", true)
    .eq("me.profile_id", userId)
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

export const rachaApi = { createRacha, listMyRachas, getRacha };
