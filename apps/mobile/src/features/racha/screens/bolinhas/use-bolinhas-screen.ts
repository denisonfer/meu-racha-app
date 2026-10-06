import { ballPlan, canGive, canReceive } from "@meu-racha/domain";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useToast } from "@/ui/components";
import type { TTeamQueueOptionProps } from "../../components/team-queue-option";
import { eventMatchKey } from "../../hooks/use-event-match";
import { useEventBolinhas } from "../../hooks/use-event-bolinhas";
import { eventSortKey } from "../../hooks/use-event-sort";
import { useOpenEvents } from "../../hooks/use-open-events";
import {
  BOLINHAS_FULL,
  BOLINHAS_IS_GIVER,
  BOLINHAS_NO_OTHER_RECEIVER,
  BOLINHAS_ON_FIELD,
  bolinhasAllMoveRow,
  bolinhasBalls,
  bolinhasGives,
  bolinhasInBag,
  bolinhasMovedToast,
  bolinhasSpots,
  sortFailureMessage,
} from "../../utils/racha-messages";
import { joinNames } from "../../utils/sort-view";
import { useBolinhasView, type TBolinhasQueueTeam } from "./use-bolinhas-view";

// conduction guarda o nome de quem conduz agora (null: o Evento nem o informou)
type TError =
  | { kind: "network" }
  | { kind: "conduction"; conductorName: string | null }
  | { kind: "changed" }
  | { kind: "other"; message: string };

export type TBolinhasRow = Omit<TTeamQueueOptionProps, "onPress"> & {
  key: string;
  onPress: () => void;
};

export function useBolinhasScreen() {
  const {
    id,
    eventId,
    rachaName,
    capacity,
    isMatchOpen,
    isLoading,
    queue,
    onField,
    availability,
  } = useBolinhasView();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const eventsQuery = useOpenEvents(id);
  const { drawBolinhas, applyDrawn, setReveal } = useEventBolinhas(id, eventId);
  const [giverNumber, setGiverNumber] = useState<number | null>(null);
  const [receiverNumber, setReceiverNumber] = useState<number | null>(null);
  const [error, setError] = useState<TError | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const firstWaiting = queue.find((t) => (t.queueOrder ?? 0) > 2);
  const giver = queue.find((t) => t.teamNumber === giverNumber) ?? null;
  const receiver = queue.find((t) => t.teamNumber === receiverNumber) ?? null;
  const spots = receiver ? Math.max(0, capacity - receiver.activeCount) : 0;

  const baseRow = (team: TBolinhasQueueTeam) => {
    const position = team.queueOrder ?? 0;
    const badges: TTeamQueueOptionProps["badges"] = [];
    if (position <= 2) badges.push(isMatchOpen ? "onField" : "nextMatch");
    if (team.teamNumber === firstWaiting?.teamNumber) badges.push("next");
    return {
      key: `team:${team.teamNumber}`,
      position,
      teamNumber: team.teamNumber,
      count: team.activeCount,
      capacity,
      badges,
    };
  };

  const pickGiver = (teamNumber: number) => {
    setGiverNumber(teamNumber);
    setReceiverNumber(null);
    setError(null);
  };
  const pickReceiver = (teamNumber: number) => {
    setReceiverNumber(teamNumber);
    setError(null);
  };

  const giverRows: TBolinhasRow[] = giver
    ? [
        {
          ...baseRow(giver),
          sub: bolinhasGives(giver.activeCount),
          subTone: "action",
          isSelected: true,
          isDisabled: false,
          onPress: () => {},
        },
      ]
    : queue.map((team) => {
        const isOnField = onField.has(team.teamNumber);
        // cede só quem tem para quem ceder: algum outro Time fora de campo com vaga
        const hasReceiver = queue.some(
          (other) =>
            other.teamNumber !== team.teamNumber &&
            canReceive(other, capacity, onField)
        );
        const isOpen = canGive(team, null, onField) && hasReceiver;
        return {
          ...baseRow(team),
          sub: isOnField
            ? BOLINHAS_ON_FIELD
            : hasReceiver
              ? bolinhasInBag(team.activeCount)
              : BOLINHAS_NO_OTHER_RECEIVER,
          subTone: "muted",
          isSelected: false,
          isDisabled: !isOpen,
          onPress: () => pickGiver(team.teamNumber),
        };
      });

  const receiverRows: TBolinhasRow[] = giver
    ? queue.map((team) => {
        const isGiver = team.teamNumber === giver.teamNumber;
        const isOnField = onField.has(team.teamNumber);
        const isOpen = !isGiver && canReceive(team, capacity, onField);
        const teamSpots = Math.max(0, capacity - team.activeCount);
        const teamPlan = ballPlan(giver.activeCount, teamSpots);
        const sub = isGiver
          ? BOLINHAS_IS_GIVER
          : isOnField
            ? BOLINHAS_ON_FIELD
            : !isOpen
              ? BOLINHAS_FULL
              : teamPlan.allMove
                ? bolinhasAllMoveRow(giver.teamNumber)
                : `${bolinhasSpots(teamSpots)} · ${bolinhasBalls(teamPlan.blue, teamPlan.red)}`;
        return {
          ...baseRow(team),
          sub,
          subTone: teamPlan.allMove && isOpen ? "warning" : "muted",
          isSelected: team.teamNumber === receiverNumber,
          isDisabled: !isOpen,
          onPress: () => pickReceiver(team.teamNumber),
        };
      })
    : [];

  const plan = giver ? ballPlan(giver.activeCount, spots) : null;
  const summary =
    receiver && giver && plan
      ? {
          giverNumber: giver.teamNumber,
          receiverNumber: receiver.teamNumber,
          count: giver.activeCount,
          receiverCount: receiver.activeCount,
          blue: plan.blue,
          red: plan.red,
          allMove: plan.allMove,
          names: giver.names,
          capacity,
        }
      : null;

  const refreshTeams = () => {
    void queryClient.invalidateQueries({ queryKey: eventSortKey(id, eventId) });
    void queryClient.invalidateQueries({
      queryKey: eventMatchKey(id, eventId),
    });
  };

  const draw = async () => {
    if (!giver || !receiver || isBusy) return;
    setError(null);
    // sem o id do Time na fila da Partida a escolha já ficou velha: relê e pede de novo
    if (!giver.teamId || !receiver.teamId) {
      refreshTeams();
      setGiverNumber(null);
      setReceiverNumber(null);
      setError({ kind: "changed" });
      return;
    }
    setIsBusy(true);
    try {
      const drawn = await drawBolinhas({
        giverTeamId: giver.teamId,
        receiverTeamId: receiver.teamId,
      });
      if (drawn.allMove) {
        const names = drawn.order.map((pick) => pick.displayName);
        showToast(
          bolinhasMovedToast(
            joinNames(names),
            receiver.teamNumber,
            names.length > 1
          ),
          "success"
        );
        router.back();
        applyDrawn(drawn);
        return;
      }
      setReveal({
        giverTeamNumber: giver.teamNumber,
        receiverTeamNumber: receiver.teamNumber,
        drawn,
      });
      // replace: o Fechar do resultado volta direto para a tela de Times
      router.replace(`/racha/${id}/event/${eventId}/bolinhas-reveal`);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      if (code === "network_error") {
        setError({ kind: "network" });
      } else if (code === "not_conductor") {
        const events = await eventsQuery.refetch();
        const conductor =
          events.data?.find((item) => item.id === eventId)?.conductorName ??
          null;
        refreshTeams();
        setError({ kind: "conduction", conductorName: conductor });
      } else if (code === "invalid_pair") {
        refreshTeams();
        setGiverNumber(null);
        setReceiverNumber(null);
        setError({ kind: "changed" });
      } else {
        setError({ kind: "other", message: sortFailureMessage(caught) });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const primary =
    error?.kind === "conduction"
      ? { isDisabled: false, onPress: () => router.back() }
      : { isDisabled: summary === null, onPress: () => void draw() };

  return {
    isLoading,
    rachaName,
    availability,
    giverRows,
    receiverRows,
    hasGiver: giver !== null,
    onChangeGiver: () => {
      setGiverNumber(null);
      setReceiverNumber(null);
      setError(null);
    },
    summary,
    error,
    isBusy,
    primary,
    goBack: () => router.back(),
  };
}
