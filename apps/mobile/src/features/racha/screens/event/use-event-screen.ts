import {
  PRICE_MAX,
  PRICE_MIN,
  dateMaskToISO,
  spotLimitFloor,
} from "@meu-racha/domain";
import { useQueryClient } from "@tanstack/react-query";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { useCreateEvent } from "../../hooks/use-create-event";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { openEventsKey, useOpenEvents } from "../../hooks/use-open-events";
import { rachaKey, useRacha } from "../../hooks/use-racha";
import { useUpdateEvent } from "../../hooks/use-update-event";
import { rachaApi } from "../../racha-api";
import { TEventInput, TOpenEvent, TRacha } from "../../racha-types";
import { isNoAccessError } from "../../utils/no-access";
import {
  DISCARD_CHANGES_TITLE,
  EVENT_NOT_ALLOWED,
  EVENT_START_PAST,
  RACHA_SAVED,
  SAVE_RACHA_FAILED,
} from "../../utils/racha-messages";
import {
  buildEventSchema,
  isoDateToMask,
  kickoffFromStartsAt,
  TEventForm,
} from "./event-schema";

const digitsOrNull = (text: string) => {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};

// 0 e 10000 não podem ficar escondidos: o banco recusa, e o campo some com o Pago
const priceWithinRange = (value: number | null) =>
  value !== null && value >= PRICE_MIN && value <= PRICE_MAX;

const brasiliaClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function brasiliaNow(): string {
  const parts = Object.fromEntries(
    brasiliaClock
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

const isSameEvent = (a: TEventForm, b: TEventForm) =>
  a.startsOn === b.startsOn &&
  a.kickoffHour === b.kickoffHour &&
  a.kickoffMinute === b.kickoffMinute &&
  a.place.trim() === b.place.trim() &&
  a.isPaid === b.isPaid &&
  a.price === b.price &&
  a.spotLimit === b.spotLimit;

const messageFor = (
  issues: { path: PropertyKey[]; message: string }[],
  key: string
) => issues.find((issue) => issue.path[0] === key)?.message;

const formFromRacha = (racha: TRacha): TEventForm => ({
  startsOn: "",
  kickoffHour: racha.kickoffHour,
  kickoffMinute: racha.kickoffMinute,
  place: racha.place,
  isPaid: racha.isPaid,
  price: racha.price,
  spotLimit: racha.spotLimit,
});

const formFromEvent = (event: TOpenEvent): TEventForm => {
  const kickoff = kickoffFromStartsAt(event.startsAt);
  return {
    startsOn: isoDateToMask(event.startsOn),
    kickoffHour: kickoff.kickoffHour,
    kickoffMinute: kickoff.kickoffMinute,
    place: event.place,
    isPaid: event.isPaid,
    price: event.price,
    spotLimit: event.spotLimit,
  };
};

export type TEventEditor =
  | { mode: "create"; racha: TRacha }
  | { mode: "edit"; racha: TRacha; event: TOpenEvent };

export function useEventScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId?: string;
  }>();
  const isEdit = typeof eventId === "string" && eventId.length > 0;
  const {
    data: racha,
    isPending,
    error,
    fetchStatus,
    refetch,
    isRefetching,
  } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const { session, isLoading: isSessionLoading } = useSession();
  const isNoAccess = useLeaveOnNoAccess(error, fetchStatus, id);

  // cache velho no remount não expulsa um Admin: só com a consulta parada
  const isPlayer = racha?.role === "PLAYER" && fetchStatus === "idle";
  const isStalePlayer = racha?.role === "PLAYER" && fetchStatus !== "idle";

  const event = isEdit
    ? eventsQuery.data?.find((item) => item.id === eventId)
    : undefined;
  const eventsIdle = eventsQuery.fetchStatus === "idle";
  const isNotConductor =
    !!event &&
    event.status === "active" &&
    event.conductorId !== session?.userId;
  // a sessão deste hook nasce vazia: sem userId, o Condutor cairia no redirect
  const isActiveStranger =
    isEdit && eventsIdle && !isSessionLoading && isNotConductor;
  const isStaleActiveStranger =
    isEdit && (!eventsIdle || isSessionLoading) && isNotConductor;
  // sumiu da agenda aberta: a home é o lugar, sem toast
  const isMissingEvent =
    isEdit && eventsIdle && eventsQuery.isSuccess && event === undefined;

  const mustLeave = isPlayer || isActiveStranger || isMissingEvent;

  useEffect(() => {
    if (mustLeave) router.dismissTo(`/racha/${id}`);
  }, [mustLeave, id]);

  const isBlocked =
    isNoAccess ||
    isPlayer ||
    isStalePlayer ||
    isActiveStranger ||
    isStaleActiveStranger ||
    isMissingEvent ||
    (isEdit && eventsQuery.isPending);

  const canEdit = !isBlocked && racha && (!isEdit || event);

  return {
    mode: isEdit ? ("edit" as const) : ("create" as const),
    racha: canEdit ? racha : undefined,
    event: canEdit && isEdit ? event : undefined,
    isLoading: isPending || isBlocked,
    retry: () => {
      void refetch();
      if (isEdit) void eventsQuery.refetch();
    },
    isRetrying: isRefetching || eventsQuery.isRefetching,
  };
}

export function useEventForm(editor: TEventEditor) {
  const { racha } = editor;
  const event = editor.mode === "edit" ? editor.event : null;
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const showToast = useToast();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { createEvent } = useCreateEvent(racha.id);
  const { updateEvent } = useUpdateEvent(racha.id, event?.id ?? "");
  const hasRachaAccess = useHasRachaAccess(racha.id);

  // uma recarga no meio da edição não pode reescrever o que foi digitado
  const [initial] = useState<TEventForm>(() =>
    event ? formFromEvent(event) : formFromRacha(racha)
  );
  const [values, setValues] = useState(initial);
  // criar olha a linha do racha, que pode mudar com a tela aberta; editar olha
  // a linha copiada no evento, que o update não mexe
  const [outfieldPerTeam, setOutfieldPerTeam] = useState(
    event ? event.outfieldPerTeam : racha.rules.outfieldPerTeam
  );
  const [failedValues, setFailedValues] = useState<TEventForm | null>(null);
  const [saveFailureReason, setSaveFailureReason] = useState<
    "generic" | "past_date"
  >("generic");
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [nowCivil, setNowCivil] = useState(brasiliaNow);
  const [leaveMode, setLeaveMode] = useState<"home" | null>(null);

  const requireFuture = event?.status !== "active";

  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => setNowCivil(brasiliaNow()), 30_000);
    return () => clearInterval(timer);
  }, [isFocused]);

  const parsed = buildEventSchema(
    outfieldPerTeam,
    nowCivil,
    requireFuture
  ).safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const isDirty = !isSameEvent(values, initial);

  const failureMessage =
    failedValues !== null && !isSaving && isSameEvent(failedValues, values)
      ? saveFailureReason === "past_date"
        ? EVENT_START_PAST
        : SAVE_RACHA_FAILED
      : null;

  // só com a tela em foco, no mesmo desenho da tela 10: POP_TO (dismissTo)
  // não é um voltar da pessoa, e salvar bloqueia a saída
  usePreventRemove(
    isFocused && leaveMode === null && (isDirty || isSaving),
    ({ data }) => {
      if (data.action.type === "POP_TO") {
        navigation.dispatch(data.action);
        return;
      }
      if (isSaving) return;
      Alert.alert(DISCARD_CHANGES_TITLE, undefined, [
        { text: "Continuar editando", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
    }
  );

  // o bloqueio só cai no render seguinte
  useEffect(() => {
    if (leaveMode === "home") router.dismissTo(`/racha/${racha.id}`);
  }, [leaveMode, racha.id]);

  const showFreshSpotLimitError = async () => {
    const userId = session?.userId;
    if (!userId) {
      setFailedValues(values);
      return;
    }
    try {
      if (!event) {
        const fresh = await queryClient.fetchQuery({
          queryKey: rachaKey(racha.id),
          queryFn: () => rachaApi.getRacha(racha.id, userId),
          staleTime: 0,
        });
        const floor = spotLimitFloor(fresh.rules.outfieldPerTeam);
        setOutfieldPerTeam(fresh.rules.outfieldPerTeam);
        if (values.spotLimit === null || values.spotLimit >= floor) {
          setFailedValues(values);
        }
        return;
      }
      const freshEvents = await queryClient.fetchQuery({
        queryKey: openEventsKey(racha.id),
        queryFn: () => rachaApi.listOpenEvents(racha.id),
        staleTime: 0,
      });
      const freshEvent = freshEvents.find((item) => item.id === event.id);
      if (!freshEvent) {
        setFailedValues(values);
        return;
      }
      const floor = spotLimitFloor(freshEvent.outfieldPerTeam);
      setOutfieldPerTeam(freshEvent.outfieldPerTeam);
      if (values.spotLimit === null || values.spotLimit >= floor) {
        setFailedValues(values);
      }
    } catch (reloadError) {
      if (!isNoAccessError(reloadError)) setFailedValues(values);
    }
  };

  const persist = async (input: TEventInput) => {
    setIsSaving(true);
    try {
      if (event) await updateEvent(input);
      else await createEvent(input);
      showToast(RACHA_SAVED, "success");
      setLeaveMode("home");
    } catch (error) {
      if (error instanceof Error && error.message === "not_allowed") {
        const stillMember = await hasRachaAccess();
        // quem perdeu o Racha sai pelo useLeaveOnNoAccess, sem este toast
        if (stillMember) {
          showToast(EVENT_NOT_ALLOWED);
          setLeaveMode("home");
        }
        return;
      }
      if (
        error instanceof Error &&
        error.message === "spot_limit_fits_two_teams"
      ) {
        await showFreshSpotLimitError();
        return;
      }
      if (error instanceof Error && error.message === "past_date") {
        setNowCivil(brasiliaNow());
        setSaveFailureReason("past_date");
        setFailedValues(values);
        return;
      }
      setSaveFailureReason("generic");
      setFailedValues(values);
    } finally {
      setIsSaving(false);
    }
  };

  const save = () => {
    if (isSaving) return;
    const freshNow = brasiliaNow();
    setNowCivil(freshNow);
    const result = buildEventSchema(
      outfieldPerTeam,
      freshNow,
      requireFuture
    ).safeParse(values);
    if (!result.success) return;
    const startsOn = dateMaskToISO(result.data.startsOn);
    if (
      !startsOn ||
      result.data.kickoffHour === null ||
      result.data.kickoffMinute === null
    ) {
      return;
    }
    void persist({
      startsOn,
      kickoffHour: result.data.kickoffHour,
      kickoffMinute: result.data.kickoffMinute,
      place: result.data.place,
      isPaid: result.data.isPaid,
      price: result.data.price,
      spotLimit: result.data.spotLimit,
    });
  };

  return {
    values,
    errors: {
      startsOn: messageFor(issues, "startsOn"),
      slot: messageFor(issues, "slot"),
      hour: messageFor(issues, "kickoffHour"),
      minute: messageFor(issues, "kickoffMinute"),
      place: messageFor(issues, "place"),
      price: messageFor(issues, "price"),
      spotLimit: messageFor(issues, "spotLimit"),
    },
    isSaving,
    isDatePickerOpen,
    today: nowCivil.slice(0, 10),
    isDirty,
    canSave: parsed.success && isDirty,
    failureMessage,
    setStartsOn: (startsOn: string) =>
      setValues((current) => ({ ...current, startsOn })),
    openDatePicker: () => {
      setNowCivil(brasiliaNow());
      setIsDatePickerOpen(true);
    },
    closeDatePicker: () => setIsDatePickerOpen(false),
    setHour: (kickoffHour: number | null) =>
      setValues((current) => ({ ...current, kickoffHour })),
    setMinute: (kickoffMinute: number | null) =>
      setValues((current) => ({ ...current, kickoffMinute })),
    setPlace: (place: string) =>
      setValues((current) => ({ ...current, place })),
    // ligar não mexe no número; desligar devolve o gravado se o digitado
    // está fora de 1–9999, senão o Salvar trava num erro que a tela escondeu
    setIsPaid: (isPaid: boolean) =>
      setValues((current) => ({
        ...current,
        isPaid,
        price:
          isPaid || priceWithinRange(current.price) || current.price === null
            ? current.price
            : initial.price,
      })),
    setPriceText: (text: string) =>
      setValues((current) => ({ ...current, price: digitsOrNull(text) })),
    setSpotLimitText: (text: string) =>
      setValues((current) => ({
        ...current,
        spotLimit: digitsOrNull(text),
      })),
    save,
  };
}
