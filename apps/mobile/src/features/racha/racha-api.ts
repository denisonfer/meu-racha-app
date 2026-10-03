import type { PostgrestError } from "@supabase/supabase-js";
import {
  initialsOf,
  normalizeInviteCode,
  OVERALL_MIN,
  type TRachaRules,
} from "@meu-racha/domain";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET } from "@/lib/storage-buckets";
import {
  TAttendanceList,
  TAttendancePerson,
  TAttendanceStatus,
  TAttendanceTarget,
  TCreatedRacha,
  TEventInput,
  TGuestInput,
  TInvite,
  TInviteStatus,
  TJoinRequest,
  TMyJoinRequest,
  TMemberRole,
  TMemberUpdate,
  TMyRacha,
  TMyRachaEvent,
  TOpenEvent,
  TRacha,
  TRachaMember,
  TRachaLogistics,
  TRachaNotice,
  TRachaSettings,
} from "./racha-types";
import { attendancePaymentNote } from "./utils/racha-messages";

// raise exception chega na message, não no code
const RAISE_EXCEPTION_CODES = [
  "plan_owner_limit",
  "already_resolved",
  "not_allowed",
  "stars_required",
  "not_member",
  "admin_limit",
  "owner_cannot_leave",
  "past_date",
  "event_exists",
  "event_active",
  "conductor",
  "spot_limit",
  "spot_limit_below_occupancy",
  "event_month_locked",
  "not_confirmed",
  "mensalista_paid",
  "monthly_price_required",
  "payer_target_required",
  "payer_target_invalid",
  "credit_already_used",
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

function toAttendanceStatus(value: string | null): TAttendanceStatus | null {
  return value === "confirmed" ||
    value === "waitlisted" ||
    value === "cancelled"
    ? value
    : null;
}

function throwSpotLimitCheckViolation(error: PostgrestError): void {
  if (
    error.code === "23514" &&
    error.message.includes("spot_limit_fits_two_teams")
  ) {
    throw new Error("spot_limit_fits_two_teams");
  }
}

function throwEventConstraintViolation(error: PostgrestError): void {
  if (error.code === "23514" && error.message.includes("event_place_text")) {
    throw new Error("event_place_text");
  }
  if (
    error.code === "23514" &&
    error.message.includes("event_spot_limit_fits_two_teams")
  ) {
    throw new Error("spot_limit_fits_two_teams");
  }
  if (error.code === "23505" && error.message.includes("event_one_upcoming")) {
    throw new Error("event_exists");
  }
}

function parseKickoffTime(kickoffTime: string | null): {
  kickoffHour: number | null;
  kickoffMinute: number | null;
} {
  if (kickoffTime === null) {
    return { kickoffHour: null, kickoffMinute: null };
  }
  const [hour, minute] = kickoffTime.split(":");
  return { kickoffHour: Number(hour), kickoffMinute: Number(minute) };
}

function formatKickoffTimeForRpc(
  kickoffHour: number | null,
  kickoffMinute: number | null
): string | null {
  if (kickoffHour === null || kickoffMinute === null) return null;
  const hour = String(kickoffHour).padStart(2, "0");
  const minute = String(kickoffMinute).padStart(2, "0");
  return `${hour}:${minute}:00`;
}

async function createRacha(
  name: string,
  place: string,
  rules: TRachaRules,
  minAge: number | null
): Promise<TCreatedRacha> {
  const { data, error, status } = await supabase.rpc("create_racha", {
    p_name: name,
    p_place: place,
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
      "id, name, invite_code, place, weekday, kickoff_time, is_paid, price, monthly_price, spot_limit, payer_target, outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position, match_duration_min, min_age, members:member(count), me:member(role), pending:join_request(count)"
    )
    .eq("id", id)
    .eq("members.is_active", true)
    .eq("me.profile_id", userId)
    .eq("pending.status", "PENDING")
    .single();
  if (error) throw toCodedError(error, status);

  const me = data.me[0];

  if (!me) throw new Error("not_a_member");

  const { kickoffHour, kickoffMinute } = parseKickoffTime(data.kickoff_time);

  return {
    id: data.id,
    name: data.name,
    inviteCode: data.invite_code,
    role: me.role,
    memberCount: data.members[0]?.count ?? 0,
    pendingCount: data.pending[0]?.count ?? 0,
    minAge: data.min_age,
    place: data.place,
    weekday: data.weekday,
    kickoffHour,
    kickoffMinute,
    isPaid: data.is_paid,
    price: data.price,
    monthlyPrice: data.monthly_price,
    spotLimit: data.spot_limit,
    payerTarget: data.payer_target,
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
  if (error) {
    throwSpotLimitCheckViolation(error);
    throw toCodedError(error, status);
  }
  // a RLS filtra quem não é Dono: 0 linhas, sem erro
  if (data.length === 0) throw new Error("not_allowed");
}

async function updateRachaLogistics(
  id: string,
  logistics: TRachaLogistics
): Promise<void> {
  const kickoffTime = formatKickoffTimeForRpc(
    logistics.kickoffHour,
    logistics.kickoffMinute
  );
  const { error, status } = await supabase.rpc("update_racha_logistics", {
    p_racha_id: id,
    p_place: logistics.place,
    // o tipo gerado diz not-null; null quando não recorrente
    p_weekday: logistics.weekday as number,
    p_kickoff_time: kickoffTime as string,
    p_min_age: logistics.minAge as number,
    p_is_paid: logistics.isPaid,
    p_price: logistics.price as number,
    p_monthly_price: logistics.monthlyPrice as number,
    p_spot_limit: logistics.spotLimit as number,
    p_payer_target: logistics.payerTarget as number,
  });
  if (error) {
    throwSpotLimitCheckViolation(error);
    throw toCodedError(error, status);
  }
}

async function deleteRacha(id: string): Promise<void> {
  const { data, error, status } = await supabase
    .from("racha")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw toCodedError(error, status);
  // 0 linhas também é evento rolando; a tela distingue pela leitura, não por outro código
  if (data.length === 0) throw new Error("not_allowed");
}

async function listOpenEvents(rachaId: string): Promise<TOpenEvent[]> {
  const { data, error, status } = await supabase.rpc("list_open_events", {
    p_racha_id: rachaId,
  });
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    id: row.id,
    status: row.status,
    startsOn: row.starts_on,
    startsAt: row.starts_at,
    place: row.place,
    isPaid: row.is_paid,
    outfieldPerTeam: row.outfield_per_team,
    // o tipo gerado diz not-null; preço, vagas e condutor vêm null
    price: row.price ?? null,
    spotLimit: row.spot_limit ?? null,
    payerTarget: row.payer_target ?? null,
    conductorId: row.conductor_id ?? null,
    conductorName: row.conductor_name ?? null,
    confirmedCount: row.confirmed_count,
    // o tipo gerado diz string; sem linha de presença vem null
    myStatus: toAttendanceStatus(row.my_status ?? null),
    myQueuePosition: row.my_queue_position ?? null,
  }));
}

async function listMyRachaEvents(): Promise<TMyRachaEvent[]> {
  const { data, error, status } = await supabase.rpc("list_my_racha_events");
  if (error) throw toCodedError(error, status);

  return data.map((row) => ({
    rachaId: row.racha_id,
    id: row.id,
    status: row.status,
    startsOn: row.starts_on,
    startsAt: row.starts_at,
    place: row.place,
    confirmedCount: row.confirmed_count,
    spotLimit: row.spot_limit,
    // o tipo gerado diz string; sem linha de presença vem null
    myStatus: toAttendanceStatus(row.my_status ?? null),
    myQueuePosition: row.my_queue_position ?? null,
  }));
}

async function createEvent(
  rachaId: string,
  input: TEventInput
): Promise<string> {
  const startsAt = formatKickoffTimeForRpc(
    input.kickoffHour,
    input.kickoffMinute
  );
  const { data, error, status } = await supabase.rpc("create_event", {
    p_racha_id: rachaId,
    p_starts_on: input.startsOn,
    // hora 0 é horário; null numa das metades fica null. o tipo gerado diz string/number
    p_starts_at: startsAt as string,
    p_place: input.place,
    p_is_paid: input.isPaid,
    p_price: input.price as number,
    p_spot_limit: input.spotLimit as number,
    p_payer_target: input.payerTarget as number,
  });
  if (error) {
    throwEventConstraintViolation(error);
    throw toCodedError(error, status);
  }
  if (!data) throw new Error("create_event_empty");
  return data;
}

async function updateEvent(eventId: string, input: TEventInput): Promise<void> {
  const startsAt = formatKickoffTimeForRpc(
    input.kickoffHour,
    input.kickoffMinute
  );
  const { error, status } = await supabase.rpc("update_event", {
    p_event_id: eventId,
    p_starts_on: input.startsOn,
    // hora 0 é horário; null numa das metades fica null. o tipo gerado diz string/number
    p_starts_at: startsAt as string,
    p_place: input.place,
    p_is_paid: input.isPaid,
    p_price: input.price as number,
    p_spot_limit: input.spotLimit as number,
    p_payer_target: input.payerTarget as number,
  });
  if (error) {
    throwEventConstraintViolation(error);
    throw toCodedError(error, status);
  }
}

async function cancelEvent(eventId: string): Promise<void> {
  const { error, status } = await supabase.rpc("cancel_event", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);
}

async function assumeEventConduction(eventId: string): Promise<void> {
  const { error, status } = await supabase.rpc("assume_event_conduction", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);
}

async function finishEvent(eventId: string): Promise<void> {
  const { error, status } = await supabase.rpc("finish_event", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);
}

async function listEventAttendance(eventId: string): Promise<TAttendanceList> {
  const { data, error, status } = await supabase.rpc("list_event_attendance", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);

  const head = data[0];
  const people: TAttendancePerson[] = data.map((row) => {
    const kind = row.kind === "guest" ? "guest" : "member";
    return {
      kind,
      profileId: row.profile_id ?? null,
      guestId: row.guest_id ?? null,
      name: row.display_name,
      photoUrl: toPhotoUrl(row.avatar_path),
      initials: initialsOf(row.display_name),
      overall: OVERALL_MIN,
      // Avulso: confirmed implícito — a UI usa o chip Avulso, não o status
      status: kind === "guest" ? null : row.status,
      queuePosition: row.queue_position ?? null,
      didAttend: row.did_attend,
      isPaidEffective: row.is_paid_effective,
      isMonthlyPass: row.is_monthly_pass,
      playsAs: row.plays_as,
      primaryPosition: row.primary_position ?? null,
      secondaryPosition: row.secondary_position ?? null,
      role: row.role ?? null,
      stars: row.stars ?? null,
      isSuperStar: row.is_super_star,
      paymentNote: attendancePaymentNote(
        row.credit_applied_amount ?? null,
        row.cash_paid_amount ?? null
      ),
      creditBalance: row.credit_balance ?? null,
    };
  });

  return {
    eventStatus: head?.event_status ?? "upcoming",
    payerTarget: head?.payer_target ?? null,
    presentPayerCount: head?.present_payer_count ?? 0,
    myCreditBalance: head?.my_credit_balance ?? 0,
    people,
  };
}

async function confirmAttendance(eventId: string): Promise<void> {
  const { error, status } = await supabase.rpc("confirm_attendance", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);
}

async function cancelAttendance(eventId: string): Promise<void> {
  const { error, status } = await supabase.rpc("cancel_attendance", {
    p_event_id: eventId,
  });
  if (error) throw toCodedError(error, status);
}

async function setAttendanceForMember(
  eventId: string,
  profileId: string,
  attendanceStatus: Extract<TAttendanceStatus, "confirmed" | "cancelled">
): Promise<void> {
  const { error, status } = await supabase.rpc("set_attendance_for_member", {
    p_event_id: eventId,
    p_profile_id: profileId,
    p_status: attendanceStatus,
  });
  if (error) throw toCodedError(error, status);
}

function attendanceTargetArgs(target: TAttendanceTarget): {
  p_profile_id: string;
  p_guest_id: string;
} {
  // exatamente um dos dois; o tipo gerado diz string obrigatória
  if (target.kind === "member") {
    return {
      p_profile_id: target.profileId,
      p_guest_id: null as unknown as string,
    };
  }
  return {
    p_profile_id: null as unknown as string,
    p_guest_id: target.guestId,
  };
}

async function setAttendanceAttended(
  eventId: string,
  target: TAttendanceTarget,
  didAttend: boolean
): Promise<void> {
  const { error, status } = await supabase.rpc("set_attendance_attended", {
    p_event_id: eventId,
    ...attendanceTargetArgs(target),
    p_did_attend: didAttend,
  });
  if (error) throw toCodedError(error, status);
}

async function setAttendancePaid(
  eventId: string,
  target: TAttendanceTarget,
  paid: boolean
): Promise<void> {
  const { error, status } = await supabase.rpc("set_attendance_paid", {
    p_event_id: eventId,
    ...attendanceTargetArgs(target),
    p_paid: paid,
  });
  if (error) throw toCodedError(error, status);
}

async function addGuest(eventId: string, input: TGuestInput): Promise<string> {
  const { data, error, status } = await supabase.rpc("add_guest", {
    p_event_id: eventId,
    p_display_name: input.displayName,
    p_plays_as: input.playsAs,
    // null pro Goleiro; o tipo gerado diz obrigatório
    p_primary_position: input.primaryPosition as NonNullable<
      typeof input.primaryPosition
    >,
    p_secondary_position: input.secondaryPosition as NonNullable<
      typeof input.secondaryPosition
    >,
    p_stars: input.stars as number,
    p_is_super_star: input.isSuperStar,
  });
  if (error) throw toCodedError(error, status);
  if (!data) throw new Error("add_guest_empty");
  return data;
}

async function removeGuest(guestId: string): Promise<void> {
  const { error, status } = await supabase.rpc("remove_guest", {
    p_guest_id: guestId,
  });
  if (error) throw toCodedError(error, status);
}

async function setMonthlyPass(
  rachaId: string,
  profileId: string,
  yearMonth: string,
  enabled: boolean
): Promise<void> {
  const { error, status } = await supabase.rpc("set_monthly_pass", {
    p_racha_id: rachaId,
    p_profile_id: profileId,
    p_year_month: yearMonth,
    p_enabled: enabled,
  });
  if (error) throw toCodedError(error, status);
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
    // null mantém o Cargo; o tipo gerado diz obrigatório
    p_role: update.role as TMemberRole,
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

async function transferOwnership(
  rachaId: string,
  profileId: string
): Promise<void> {
  const { error, status } = await supabase.rpc("transfer_ownership", {
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
  transferOwnership,
  leaveRacha,
  listRachaNotices,
  dismissRachaNotice,
  updateRacha,
  updateRachaLogistics,
  deleteRacha,
  listOpenEvents,
  listMyRachaEvents,
  createEvent,
  updateEvent,
  cancelEvent,
  assumeEventConduction,
  finishEvent,
  listEventAttendance,
  confirmAttendance,
  cancelAttendance,
  setAttendanceForMember,
  setAttendanceAttended,
  setAttendancePaid,
  addGuest,
  removeGuest,
  setMonthlyPass,
};
