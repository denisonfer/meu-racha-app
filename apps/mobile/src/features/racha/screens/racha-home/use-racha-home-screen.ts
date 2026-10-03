import {
  applyBrlMask,
  canLeaveRacha,
  formatEventWhen,
  formatRulesSummary,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "@/features/auth";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import { TOpenEvent } from "../../racha-types";
import { pendingCountLabel, pendingWord } from "../../utils/racha-labels";
import { conductorName } from "../../utils/racha-messages";
import { shareInvite } from "../../utils/share-invite";
import { TEventCardAction } from "./event-card";

export function useRachaHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data: racha,
    isPending,
    error,
    fetchStatus,
    refetch,
    isRefetching,
  } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const { session } = useSession();
  const isNoAccess = useLeaveOnNoAccess(error, fetchStatus, id);

  const userId = session?.userId ?? null;
  const events = eventsQuery.data;
  const hasEventsData = events !== undefined;
  const activeEvent =
    events?.find((event) => event.status === "active") ?? null;
  const upcomingEvent =
    events?.find((event) => event.status === "upcoming") ?? null;
  // Com os dois, o evento em curso ocupa o cartão até ser encerrado.
  const shownEvent = activeEvent ?? upcomingEvent;
  const hiddenUpcoming = activeEvent ? upcomingEvent : null;

  const isOwnerOrAdmin = racha
    ? racha.role === "OWNER" || racha.role === "ADMIN"
    : false;
  const pendingRow =
    racha && isOwnerOrAdmin && racha.pendingCount > 0
      ? {
          count: racha.pendingCount,
          word: pendingWord(racha.pendingCount),
          label: pendingCountLabel(racha.pendingCount),
        }
      : null;

  // agenda já carregada: o Condutor continua sem sair enquanto a leitura refaz.
  // events ainda undefined não esconde: não há conductorId
  const isActiveConductor =
    userId !== null && activeEvent?.conductorId === userId;

  const openAssume = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/assume`);
  };

  const openEdit = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}`);
  };
  const openCancel = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/cancel`);
  };
  const openFinish = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/finish`);
  };
  const openAttendance = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/attendance`);
  };

  const actionsFor = (event: TOpenEvent): TEventCardAction[] => {
    if (!racha || racha.role === "PLAYER") return [];
    if (event.status === "upcoming") {
      return [
        { kind: "edit", onPress: () => openEdit(event.id) },
        { kind: "cancel", onPress: () => openCancel(event.id) },
      ];
    }
    if (event.status === "active") {
      return [
        ...(event.conductorId !== userId
          ? [{ kind: "assume" as const, onPress: () => openAssume(event.id) }]
          : [
              { kind: "finish" as const, onPress: () => openFinish(event.id) },
              { kind: "edit" as const, onPress: () => openEdit(event.id) },
            ]),
      ];
    }
    return [];
  };

  const priceLabel = (event: TOpenEvent) => {
    if (!event.isPaid) return "Grátis";
    if (event.price === null) return null;
    const masked = applyBrlMask(String(event.price));
    return masked === "" ? null : masked;
  };

  const conductorLine = (event: TOpenEvent) => {
    if (!event.conductorName || !event.conductorId) {
      return null;
    }
    if (event.conductorId === userId)
      return "Você está conduzindo este evento.";
    return conductorName(event.conductorName);
  };

  // "Criar evento" some com um upcoming, mesmo escondido atrás do evento em curso.
  const showCreateEvent = Boolean(
    racha && isOwnerOrAdmin && hasEventsData && !upcomingEvent
  );

  return {
    racha: racha && {
      name: racha.name,
      role: racha.role,
      inviteCode: racha.inviteCode,
      isOwner: racha.role === "OWNER",
      isOwnerOrAdmin,
      place: racha.place,
      memberCount: racha.memberCount,
      pendingRow,
      // no formulário a idade tem bloco próprio; na home, só o resumo a mostra
      summary:
        racha.minAge === null
          ? formatRulesSummary(racha.rules)
          : [
              ...formatRulesSummary(racha.rules),
              `A partir de ${racha.minAge} anos`,
            ],
    },
    eventCard: shownEvent && {
      kicker:
        shownEvent.status === "active" ? "Evento em curso" : "Evento agendado",
      when: formatEventWhen(shownEvent.startsOn, shownEvent.startsAt),
      place: shownEvent.place,
      isPaid: shownEvent.isPaid,
      price: priceLabel(shownEvent),
      monthlyPrice:
        shownEvent.isPaid && racha?.monthlyPrice != null
          ? applyBrlMask(String(racha.monthlyPrice))
          : null,
      spotLimit: shownEvent.spotLimit,
      conductorLine: conductorLine(shownEvent),
      confirmedCount: shownEvent.confirmedCount,
      myStatus: shownEvent.myStatus,
      myQueuePosition: shownEvent.myQueuePosition,
      onOpenAttendance: () => openAttendance(shownEvent.id),
      actions: actionsFor(shownEvent),
      upcoming: hiddenUpcoming
        ? {
            when: formatEventWhen(
              hiddenUpcoming.startsOn,
              hiddenUpcoming.startsAt
            ),
            conductorLine: conductorLine(hiddenUpcoming),
            ...(isOwnerOrAdmin
              ? {
                  onEdit: () => openEdit(hiddenUpcoming.id),
                  onCancel: () => openCancel(hiddenUpcoming.id),
                }
              : {}),
          }
        : null,
    },
    showEmptyEvent: Boolean(racha && hasEventsData && !shownEvent),
    showCreateEvent,
    eventsMissing: eventsQuery.isError && events === undefined,
    canLeave: racha ? canLeaveRacha(racha.role) && !isActiveConductor : false,
    showConductorCannotLeave: Boolean(
      racha && racha.role !== "OWNER" && isActiveConductor
    ),
    isLoading: isPending || isNoAccess || eventsQuery.isPending,
    retry: () => {
      void refetch();
      void eventsQuery.refetch();
    },
    isRetrying: isRefetching || eventsQuery.isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
    backToRachas: () => router.navigate("/rachas"),
    openRequests: () => router.push(`/racha/${id}/requests`),
    openMembers: () => router.push(`/racha/${id}/members`),
    openSettings: () => router.push(`/racha/${id}/settings`),
    openLogistics: () => router.push(`/racha/${id}/logistics`),
    openLeave: () => router.push(`/racha/${id}/leave`),
    openCreateEvent: () => router.push(`/racha/${id}/event/new`),
  };
}
