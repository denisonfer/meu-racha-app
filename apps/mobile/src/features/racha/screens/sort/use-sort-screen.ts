import {
  asksPositionDetail,
  formatEventWhen,
  formatPlaysAs,
  OVERALL_MIN,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import type { TSortPersonListRow } from "../../components/sort-person-list";
import type { TSortPublishedSection } from "../../components/sort-published-view";
import type { TSortRowAction } from "../../components/sort-team-card";
import { useEventAttendance } from "../../hooks/use-event-attendance";
import { useOpenEvents } from "../../hooks/use-open-events";
import {
  useEventSortDraft,
  useEventSortProposal,
} from "../../hooks/use-event-sort-proposal";
import {
  useEventSort,
  useEventSortOperations,
} from "../../hooks/use-event-sort";
import { useRacha } from "../../hooks/use-racha";
import type { TAttendanceTarget } from "../../racha-types";
import {
  ATTENDANCE_QUEUE_HINT,
  POSITION_DETAIL_BLOCKED,
  POSITION_DETAIL_COMPLETE,
  POSITION_DETAIL_PENDING_GROUP,
  POSITION_DETAIL_SORT_TEXT,
  positionDetailCompleteLabel,
  positionDetailPendingTitle,
  SORT_BALANCE_CONFIRMED,
  SORT_MARK_ATTENDED_HINT,
  SORT_WAITING_NOT_ATTENDED,
  sortAttendanceSummary,
  SORT_BALANCE_PROPOSAL,
  SORT_GOALKEEPER_QUEUE,
  SORT_INCLUDE,
  SORT_LEAVE_OTHER,
  SORT_LEAVE_SELF,
  SORT_LEAVE_SELF_LABEL,
  SORT_LEFT_DETAIL,
  SORT_RETURN,
  SORT_ROSTER_CHANGED,
  SORT_TEAMS_TITLE,
  SORT_TITLE,
  sortConductingLine,
  sortFailureMessage,
  sortGoalkeeperQueuePosition,
  sortIncludeLabel,
  sortLeaveOtherLabel,
  sortLeftTitle,
  sortMissingLinePlayers,
  sortReturnLabel,
  sortScoreLabel,
  sortSuperWarningText,
  sortTeamTitle,
  sortWaitingTitle,
} from "../../utils/racha-messages";
import { eventKicker } from "../../utils/racha-labels";
import {
  joinNames,
  sortGoalkeeperEntries,
  sortPendingPeople,
  sortPersonId,
  superWarningNames,
} from "../../utils/sort-view";
import { buildTeamCards, type TSortLeaveActionFor } from "./build-sort-views";

// outro aparelho pode confirmar, mudar a lista ou conduzir: sem push, a tela relê
const REFRESH_MS = 15_000;

type TPending = "sort" | "swap" | null;

const targetOf = (person: {
  profileId: string | null;
  guestId: string | null;
}): TAttendanceTarget | null =>
  person.profileId
    ? { kind: "member", profileId: person.profileId }
    : person.guestId
      ? { kind: "guest", guestId: person.guestId }
      : null;

export function useSortScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const showToast = useToast();
  const { data: racha } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const sortQuery = useEventSort(id, eventId);
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const published =
    sortQuery.data?.state === "published" ? sortQuery.data : null;

  // o Condutor de um Evento ainda sem Sorteio vem da agenda; o publicado traz o dele
  const isConductor = published
    ? published.isConductor
    : userId !== null && event?.conductorId === userId;
  const isProposalEnabled = isConductor && sortQuery.data?.state === "none";
  const proposalQuery = useEventSortProposal(id, eventId, isProposalEnabled);
  const proposal = isProposalEnabled ? proposalQuery.data : undefined;

  const draft = useEventSortDraft(id, eventId);
  const operations = useEventSortOperations(id, eventId);

  const [pending, setPending] = useState<TPending>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [selectedGoalkeeper, setSelectedGoalkeeper] = useState<string | null>(
    null
  );

  const { refetch: refetchSort } = sortQuery;
  const { refetch: refetchProposal } = proposalQuery;
  useEffect(() => {
    const timer = setInterval(() => {
      void refetchSort();
      if (isProposalEnabled) void refetchProposal();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refetchSort, refetchProposal, isProposalEnabled]);

  const isLoading =
    eventsQuery.isPending ||
    sortQuery.isPending ||
    (isProposalEnabled && proposalQuery.isPending);
  const loadError =
    (sortQuery.isError && sortQuery.data === undefined
      ? sortQuery.error
      : null) ??
    (eventsQuery.isError && eventsQuery.data === undefined
      ? eventsQuery.error
      : null) ??
    (isProposalEnabled &&
    proposalQuery.isError &&
    proposalQuery.data === undefined
      ? proposalQuery.error
      : null);

  const retry = () => {
    void eventsQuery.refetch();
    void refetchSort();
    if (isProposalEnabled) void refetchProposal();
  };

  const outfieldPerTeam =
    published?.outfieldPerTeam ??
    event?.outfieldPerTeam ??
    racha?.rules.outfieldPerTeam ??
    null;
  // a proposta só traz contagens; quem está pendente sai da Presença, com a camada do banco
  const asksDetail =
    outfieldPerTeam !== null && asksPositionDetail(outfieldPerTeam);
  const attendanceQuery = useEventAttendance(
    id,
    eventId,
    isProposalEnabled && asksDetail
  );

  const isPendingWatched = isProposalEnabled && asksDetail;
  const { refetch: refetchAttendance } = attendanceQuery;
  // completar em outro aparelho também destrava: relê junto com a proposta
  useEffect(() => {
    if (!isPendingWatched) return;
    const timer = setInterval(() => void refetchAttendance(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refetchAttendance, isPendingWatched]);
  const pendingPeople = isPendingWatched
    ? sortPendingPeople(attendanceQuery.data?.people ?? [])
    : [];
  const when = event ? formatEventWhen(event.startsOn, event.startsAt) : "";
  const place = event?.place ?? racha?.place ?? "";

  const guard = async (action: () => Promise<unknown>) => {
    setFailureMessage(null);
    try {
      await action();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      // confirmado em outro aparelho: relê para abrir os Times publicados
      if (code === "already_confirmed" || code === "event_not_upcoming") {
        void refetchSort();
        return;
      }
      // o rascunho caiu e a tela já mostra “A lista mudou”
      if (code === "roster_changed" || code === "proposal_outdated") return;
      // a Presença daqui pode estar velha: relê para o aviso mostrar os mesmos nomes
      if (code === "position_detail_pending") void attendanceQuery.refetch();
      setFailureMessage(sortFailureMessage(error));
    }
  };

  const sort = async () => {
    if (pending) return;
    setPending("sort");
    setSelectedGoalkeeper(null);
    await guard(() => draft.prepareEventSort());
    setPending(null);
  };

  const readyProposal = proposal?.state === "ready" ? proposal : null;

  const selectGoalkeeper = async (goalkeeperId: string) => {
    if (!readyProposal || pending) return;
    if (selectedGoalkeeper === null) {
      setSelectedGoalkeeper(goalkeeperId);
      return;
    }
    if (selectedGoalkeeper === goalkeeperId) {
      setSelectedGoalkeeper(null);
      return;
    }
    const first = selectedGoalkeeper;
    setSelectedGoalkeeper(null);
    setPending("swap");
    await guard(() =>
      draft.swapEventSortGoalkeepers({
        version: readyProposal.version,
        goalkeeperA: first,
        goalkeeperB: goalkeeperId,
      })
    );
    setPending(null);
  };

  const runOperation = async (key: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await action();
    } catch (error) {
      showToast(sortFailureMessage(error), "danger");
    } finally {
      setBusyKey(null);
    }
  };

  const leaveActionFor: TSortLeaveActionFor = (person) => {
    if (!published) return null;
    const isMe = person.profileId !== null && person.profileId === userId;
    const canLeave =
      published.viewer.canLeaveAny || (published.viewer.canLeaveSelf && isMe);
    if (!canLeave) return null;
    const query = person.profileId
      ? `profileId=${person.profileId}`
      : `guestId=${person.guestId}`;
    return {
      label: isMe ? SORT_LEAVE_SELF : SORT_LEAVE_OTHER,
      icon: "leave",
      accessibilityLabel: isMe
        ? SORT_LEAVE_SELF_LABEL
        : sortLeaveOtherLabel(person.displayName),
      isDisabled: busyKey !== null,
      onPress: () =>
        router.push(
          `/racha/${id}/event/${eventId}/sort-leave?${query}&name=${encodeURIComponent(person.displayName)}`
        ),
    } satisfies TSortRowAction;
  };

  const noLeaveAction: TSortLeaveActionFor = () => null;

  const pendingRows: TSortPersonListRow[] = pendingPeople.map((person) => {
    const detail = formatPlaysAs(
      person.playsAs,
      person.primaryPosition,
      person.secondaryPosition
    ).replace(/^Linha · /, "");
    return {
      key: `pending:${person.profileId ?? person.guestId}`,
      name: person.name,
      photoUrl: person.photoUrl,
      overall: person.overall,
      detail,
      accessibilityLabel: `${person.name}, ${detail}`,
      isSelected: false,
      onPress: null,
      // Avulso não tem onde completar: a subdivisão dele nasce no cadastro do Evento
      action: person.profileId
        ? {
            label: POSITION_DETAIL_COMPLETE,
            accessibilityLabel: positionDetailCompleteLabel(person.name),
            isDisabled: pending !== null,
            onPress: () =>
              router.push(
                `/racha/${id}/position-detail?profileId=${person.profileId}`
              ),
          }
        : null,
    };
  });

  const buildPrepare = () => {
    if (!proposal || proposal.state === "ready") return null;
    const missing = Math.max(0, proposal.minLinePlayers - proposal.lineCount);
    return {
      kicker: eventKicker("upcoming", false),
      when,
      place,
      lineCount: proposal.lineCount,
      goalkeeperCount: proposal.goalkeeperCount,
      outfieldPerTeam,
      considerPosition: proposal.considerPosition,
      attendanceSummary: sortAttendanceSummary(
        proposal.confirmedCount,
        proposal.confirmedCount - proposal.notAttendedCount
      ),
      // sem "veio" o confirmado não entra; vale avisar mesmo quando já dá para sortear
      markAttendedText:
        proposal.notAttendedCount > 0 ? SORT_MARK_ATTENDED_HINT : null,
      blockedText: !proposal.canSort
        ? sortMissingLinePlayers(missing)
        : pendingRows.length > 0
          ? POSITION_DETAIL_BLOCKED
          : null,
      staleText: proposal.state === "stale" ? SORT_ROSTER_CHANGED : null,
      failureMessage,
      pendingNotice:
        pendingRows.length > 0
          ? {
              title: positionDetailPendingTitle(pendingRows.length),
              text: POSITION_DETAIL_SORT_TEXT,
              listTitle: POSITION_DETAIL_PENDING_GROUP,
              rows: pendingRows,
            }
          : null,
      isSorting: pending === "sort",
      onSort: () => void sort(),
      onOpenAttendance: () =>
        router.push(`/racha/${id}/event/${eventId}/attendance`),
    };
  };

  const buildProposal = () => {
    if (!readyProposal) return null;
    const goalkeeperRows: TSortPersonListRow[] = sortGoalkeeperEntries(
      readyProposal.teams,
      readyProposal.goalkeeperQueue
    ).map((entry) => {
      const where =
        entry.teamNumber !== null
          ? sortTeamTitle(entry.teamNumber)
          : sortGoalkeeperQueuePosition(entry.queueOrder ?? 0);
      const isSelected = entry.id === selectedGoalkeeper;
      return {
        key: entry.id,
        name: entry.person.displayName,
        photoUrl: entry.person.photoUrl,
        overall: OVERALL_MIN,
        detail: where,
        accessibilityLabel: `${entry.person.displayName}, ${where}`,
        isSelected,
        onPress: pending ? null : () => void selectGoalkeeper(entry.id),
        action: null,
      };
    });
    const warnings = superWarningNames(
      readyProposal.superWarning,
      readyProposal.teams
    ).map((names) => sortSuperWarningText(joinNames(names)));
    return {
      scoreText: `${Math.round(readyProposal.balance.score)}%`,
      scoreLabel: readyProposal.balance.label,
      scoreCaption: SORT_BALANCE_PROPOSAL,
      scoreAccessibilityLabel: `${sortScoreLabel(readyProposal.balance.score, readyProposal.balance.label)}. ${SORT_BALANCE_PROPOSAL}`,
      superWarnings: warnings,
      teams: buildTeamCards(
        readyProposal.teams,
        outfieldPerTeam,
        noLeaveAction
      ),
      goalkeeperRows,
      failureMessage,
      isBusy: pending !== null,
      isRerunning: pending === "sort",
      onRerun: () => void sort(),
      onConfirm: () =>
        router.push(`/racha/${id}/event/${eventId}/sort-confirm`),
    };
  };

  const buildPublished = () => {
    if (!published) return null;
    const { viewer } = published;
    const isBusy = busyKey !== null;
    const queueRows: TSortPersonListRow[] = [...published.goalkeeperQueue]
      .sort((a, b) => a.queueOrder - b.queueOrder)
      .map((entry) => ({
        key: `gk:${sortPersonId(entry)}`,
        name: entry.displayName,
        photoUrl: entry.photoUrl,
        overall: OVERALL_MIN,
        detail: sortGoalkeeperQueuePosition(entry.queueOrder),
        accessibilityLabel: `${entry.displayName}, ${sortGoalkeeperQueuePosition(entry.queueOrder)}`,
        isSelected: false,
        onPress: null,
        action: leaveActionFor(entry),
      }));
    const waitingRows: TSortPersonListRow[] = published.waitingForInclusion.map(
      (person) => {
        const detail =
          person.reason === "not_attended"
            ? SORT_WAITING_NOT_ATTENDED
            : ATTENDANCE_QUEUE_HINT(person.queuePosition ?? 0);
        return {
          key: `wait:${person.profileId}`,
          name: person.displayName,
          photoUrl: person.photoUrl,
          overall: OVERALL_MIN,
          detail: detail,
          accessibilityLabel: `${person.displayName}, ${detail}`,
          isSelected: false,
          onPress: null,
          action: viewer.canInclude
            ? {
                label: SORT_INCLUDE,
                accessibilityLabel: sortIncludeLabel(person.displayName),
                isDisabled: isBusy,
                onPress: () =>
                  void runOperation(`include:${person.profileId}`, () =>
                    operations.includeEventSortMember(person.profileId)
                  ),
              }
            : null,
        };
      }
    );
    const leftRows: TSortPersonListRow[] = published.left.map((person) => {
      const target = targetOf(person);
      return {
        key: `left:${sortPersonId(person)}`,
        name: person.displayName,
        photoUrl: person.photoUrl,
        overall: OVERALL_MIN,
        detail: SORT_LEFT_DETAIL,
        accessibilityLabel: `${person.displayName}, ${SORT_LEFT_DETAIL}`,
        isSelected: false,
        onPress: null,
        action:
          viewer.canReturn && target
            ? {
                label: SORT_RETURN,
                accessibilityLabel: sortReturnLabel(person.displayName),
                isDisabled: isBusy,
                onPress: () =>
                  void runOperation(`return:${sortPersonId(person)}`, () =>
                    operations.returnEventSortPlayer(target)
                  ),
              }
            : null,
      };
    });
    const sections: TSortPublishedSection[] = [
      { key: "queue", title: SORT_GOALKEEPER_QUEUE, rows: queueRows },
      {
        key: "waiting",
        title: sortWaitingTitle(waitingRows.length),
        rows: waitingRows,
      },
      { key: "left", title: sortLeftTitle(leftRows.length), rows: leftRows },
    ].filter((section) => section.rows.length > 0);
    const warnings = superWarningNames(
      published.superWarning,
      published.teams
    ).map((names) => sortSuperWarningText(joinNames(names)));
    return {
      when,
      place,
      scoreText: `${Math.round(published.balance.score)}%`,
      scoreLabel: published.balance.label,
      scoreCaption: SORT_BALANCE_CONFIRMED,
      scoreAccessibilityLabel: `${sortScoreLabel(published.balance.score, published.balance.label)}. ${SORT_BALANCE_CONFIRMED}`,
      superWarnings: warnings,
      teams: buildTeamCards(published.teams, outfieldPerTeam, leaveActionFor),
      sections,
      failureMessage: null,
      onInclude: viewer.canInclude
        ? () => router.push(`/racha/${id}/event/${eventId}/sort-include`)
        : null,
    };
  };

  const prepare = buildPrepare();
  const proposalView = buildProposal();
  const publishedView = buildPublished();

  return {
    title: published ? SORT_TEAMS_TITLE : SORT_TITLE,
    isLoading,
    loadErrorText: loadError ? sortFailureMessage(loadError) : null,
    isRetrying:
      eventsQuery.isRefetching ||
      sortQuery.isRefetching ||
      proposalQuery.isRefetching,
    retry,
    prepare,
    proposal: proposalView,
    published: publishedView,
    // sem Sorteio e sem condução: quem não conduz espera
    notReadyText:
      !prepare && !proposalView && !publishedView
        ? event?.conductorName && event.conductorId !== userId
          ? sortConductingLine(event.conductorName)
          : null
        : null,
  };
}
