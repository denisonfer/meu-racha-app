import {
  applyBrlMask,
  asksPositionDetail,
  canLeaveRacha,
  formatEventWhen,
  formatRulesSummary,
  isLayerPending,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { useAssumeEventConduction } from "../../hooks/use-assume-event-conduction";
import { useEventAttendance } from "../../hooks/use-event-attendance";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import { TOpenEvent } from "../../racha-types";
import {
  eventKicker,
  pendingCountLabel,
  pendingWord,
} from "../../utils/racha-labels";
import {
  ACTION_FAILED,
  conductorName,
  POSITION_DETAIL_COMPLETE,
  POSITION_DETAIL_SELF_TITLE,
  positionDetailSelfText,
} from "../../utils/racha-messages";
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
  const { assumeEventConduction } = useAssumeEventConduction(id);
  const showToast = useToast();
  const [isPreparingSort, setIsPreparingSort] = useState(false);
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

  // a camada pendente vem da Presença: só Evento 8+ pergunta, os outros nem buscam
  const asksDetail =
    shownEvent !== null && asksPositionDetail(shownEvent.outfieldPerTeam);
  const attendanceQuery = useEventAttendance(
    id,
    shownEvent?.id ?? "",
    asksDetail
  );
  const me = attendanceQuery.data?.people.find(
    (person) => person.kind === "member" && person.profileId === userId
  );
  const selfPositionNotice =
    asksDetail && shownEvent && me && isLayerPending(me)
      ? {
          title: POSITION_DETAIL_SELF_TITLE,
          text: positionDetailSelfText(shownEvent.outfieldPerTeam),
          actionLabel: POSITION_DETAIL_COMPLETE,
          onAction: () => router.push(`/racha/${id}/position-detail`),
        }
      : null;

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

  const openSort = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/sort`);
  };

  const openMatch = (eventId: string) => {
    router.push(`/racha/${id}/event/${eventId}/match`);
  };

  // Preparar o Sorteio é assumir a condução: outro Condutor pede confirmação antes
  const prepareSort = async (event: TOpenEvent) => {
    if (isPreparingSort) return;
    if (event.conductorId && event.conductorId !== userId) {
      openAssume(event.id);
      return;
    }
    if (event.conductorId === null) {
      setIsPreparingSort(true);
      try {
        await assumeEventConduction(event.id);
      } catch {
        showToast(ACTION_FAILED, "danger");
        return;
      } finally {
        setIsPreparingSort(false);
      }
    }
    openSort(event.id);
  };

  const actionsFor = (event: TOpenEvent): TEventCardAction[] => {
    if (!racha) return [];
    // Times e Partida publicados valem para qualquer Membro; o resto é de Dono/Admin
    const viewActions: TEventCardAction[] =
      event.status === "active" && event.sortConfirmed
        ? [
            { kind: "viewSort", onPress: () => openSort(event.id) },
            { kind: "viewMatch", onPress: () => openMatch(event.id) },
          ]
        : [];
    if (racha.role === "PLAYER") return viewActions;
    if (event.status === "upcoming") {
      return [
        {
          kind: "prepareSort",
          isLoading: isPreparingSort,
          onPress: () => void prepareSort(event),
        },
        { kind: "edit", onPress: () => openEdit(event.id) },
        { kind: "cancel", onPress: () => openCancel(event.id) },
      ];
    }
    if (event.status === "active") {
      return [
        ...viewActions,
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
      kicker: eventKicker(shownEvent.status, shownEvent.sortConfirmed),
      isTeamsDefined:
        shownEvent.status === "active" && shownEvent.sortConfirmed,
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
      isMatchLive:
        shownEvent.status === "active" &&
        shownEvent.sortConfirmed &&
        shownEvent.matchState === "open",
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
    selfPositionNotice,
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
