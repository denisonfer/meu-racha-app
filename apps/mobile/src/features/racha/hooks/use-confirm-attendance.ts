import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { eventAttendanceKey } from "./use-event-attendance";
import { myRachaEventsKey } from "./use-my-racha-events";
import { openEventsKey } from "./use-open-events";

type TAttendanceMutationVars = {
  rachaId: string;
  eventId: string;
};

/**
 * Confirmar / cancelar / sair da fila — CTA da própria presença (tela 20).
 * Aceita racha/evento por chamada para invalidar as listas certas.
 * Após sucesso, a lista de eventos traz myStatus/myQueuePosition atualizados.
 */
export function useConfirmAttendance() {
  const queryClient = useQueryClient();

  const settle = (
    _data: unknown,
    error: Error | null,
    vars: TAttendanceMutationVars
  ) => {
    const refresh = Promise.all([
      queryClient.invalidateQueries({ queryKey: myRachaEventsKey }),
      queryClient.invalidateQueries({
        queryKey: openEventsKey(vars.rachaId),
      }),
      queryClient.invalidateQueries({
        queryKey: eventAttendanceKey(vars.rachaId, vars.eventId),
      }),
    ]);
    // no erro, sem rede a recarga demora e prenderia o botão
    if (error) {
      void refresh;
      return;
    }
    return refresh;
  };

  const confirm = useMutation({
    mutationFn: ({ eventId }: TAttendanceMutationVars) =>
      rachaApi.confirmAttendance(eventId),
    onSettled: settle,
  });

  const cancel = useMutation({
    mutationFn: ({ eventId }: TAttendanceMutationVars) =>
      rachaApi.cancelAttendance(eventId),
    onSettled: settle,
  });

  const isBusy = (eventId: string) =>
    (confirm.isPending && confirm.variables?.eventId === eventId) ||
    (cancel.isPending && cancel.variables?.eventId === eventId);

  return {
    confirmAttendance: (rachaId: string, eventId: string) =>
      confirm.mutateAsync({ rachaId, eventId }),
    cancelAttendance: (rachaId: string, eventId: string) =>
      cancel.mutateAsync({ rachaId, eventId }),
    isAttendanceBusy: isBusy,
  };
}
