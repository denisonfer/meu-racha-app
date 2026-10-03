import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import type {
  TAttendanceStatus,
  TAttendanceTarget,
  TGuestInput,
} from "../racha-types";
import { myRachaEventsKey } from "./use-my-racha-events";
import { openEventsKey } from "./use-open-events";

export const eventAttendanceKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "attendance"] as const;

function invalidateAttendanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  rachaId: string,
  eventId: string
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: myRachaEventsKey }),
    queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
    queryClient.invalidateQueries({
      queryKey: eventAttendanceKey(rachaId, eventId),
    }),
  ]);
}

export function useEventAttendance(rachaId: string, eventId: string) {
  return useQuery({
    queryKey: eventAttendanceKey(rachaId, eventId),
    queryFn: () => rachaApi.listEventAttendance(eventId),
  });
}

/** Mutações da tela 20: Dono/Admin altera presença, veio, pagou, avulso e passe. */
export function useAttendanceAdmin(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();

  const settle = (_data: unknown, error: Error | null) => {
    const refresh = invalidateAttendanceQueries(queryClient, rachaId, eventId);
    if (error) {
      void refresh;
      return;
    }
    return refresh;
  };

  const setForMember = useMutation({
    mutationFn: ({
      profileId,
      status,
    }: {
      profileId: string;
      status: Extract<TAttendanceStatus, "confirmed" | "cancelled">;
    }) => rachaApi.setAttendanceForMember(eventId, profileId, status),
    onSettled: settle,
  });

  const setAttended = useMutation({
    mutationFn: ({
      target,
      didAttend,
    }: {
      target: TAttendanceTarget;
      didAttend: boolean;
    }) => rachaApi.setAttendanceAttended(eventId, target, didAttend),
    onSettled: settle,
  });

  const setPaid = useMutation({
    mutationFn: ({
      target,
      paid,
    }: {
      target: TAttendanceTarget;
      paid: boolean;
    }) => rachaApi.setAttendancePaid(eventId, target, paid),
    onSettled: settle,
  });

  const addGuest = useMutation({
    mutationFn: (input: TGuestInput) => rachaApi.addGuest(eventId, input),
    onSettled: settle,
  });

  const removeGuest = useMutation({
    mutationFn: (guestId: string) => rachaApi.removeGuest(guestId),
    onSettled: settle,
  });

  const setMonthlyPass = useMutation({
    mutationFn: ({
      profileId,
      yearMonth,
      enabled,
    }: {
      profileId: string;
      yearMonth: string;
      enabled: boolean;
    }) => rachaApi.setMonthlyPass(rachaId, profileId, yearMonth, enabled),
    // passe reordena fila de todos os Eventos abertos do mês
    onSettled: (_data, error) => {
      const refreshLists = Promise.all([
        queryClient.invalidateQueries({ queryKey: myRachaEventsKey }),
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
        queryClient.invalidateQueries({
          queryKey: ["racha", rachaId, "event"],
        }),
      ]);
      if (error) {
        void refreshLists;
        return;
      }
      return refreshLists;
    },
  });

  return {
    setAttendanceForMember: setForMember.mutateAsync,
    setAttendanceAttended: setAttended.mutateAsync,
    setAttendancePaid: setPaid.mutateAsync,
    addGuest: addGuest.mutateAsync,
    removeGuest: removeGuest.mutateAsync,
    setMonthlyPass: setMonthlyPass.mutateAsync,
  };
}
