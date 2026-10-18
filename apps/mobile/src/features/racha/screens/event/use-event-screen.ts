import {
  PRICE_MAX,
  PRICE_MIN,
  dateMaskToISO,
  pixKeyTypeLabel,
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
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useSession } from "@/features/auth";
import { profileKey } from "@/features/profile";
import { useToast } from "@/ui/components";
import { useCreateEvent } from "../../hooks/use-create-event";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { usePixKeyMode } from "../../hooks/use-pix-key-mode";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { openEventsKey, useOpenEvents } from "../../hooks/use-open-events";
import { rachaKey, useRacha } from "../../hooks/use-racha";
import { useRachaPixKey } from "../../hooks/use-racha-pix-key";
import { useSetEventPixKey } from "../../hooks/use-set-event-pix-key";
import { useUpdateEvent } from "../../hooks/use-update-event";
import { rachaApi } from "../../racha-api";
import { TEventInput, TOpenEvent, TRacha } from "../../racha-types";
import { isNoAccessError } from "../../utils/no-access";
import {
  checkPixKeyInput,
  initialEventPixKey,
} from "../../utils/pix-key-input";
import {
  ATTENDANCE_EVENT_MONTH_LOCKED,
  ATTENDANCE_SPOT_LIMIT_BELOW_OCCUPANCY,
  DISCARD_CHANGES_TITLE,
  EVENT_NOT_ALLOWED,
  EVENT_START_PAST,
  PIX_EVENT_HINT,
  PIX_KEY_INVALID,
  pixKeyTypeHint,
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
  a.spotLimit === b.spotLimit &&
  a.payerTarget === b.payerTarget;

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
  payerTarget: racha.payerTarget,
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
    payerTarget: event.payerTarget,
  };
};

// pixKey: a chave do Evento aberto, ou a do Racha ao criar
export type TEventEditor = (
  | { mode: "create"; racha: TRacha }
  | { mode: "edit"; racha: TRacha; event: TOpenEvent }
) & { pixKey: string };

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
  // a chave do Racha parte o campo ao criar e ao editar Evento sem chave (só Dono e Admin leem)
  const pixQuery = useRachaPixKey(id, racha != null && racha.role !== "PLAYER");
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
    (isEdit && eventsQuery.isPending) ||
    (pixQuery.isPending && pixQuery.fetchStatus !== "idle");

  const canEdit =
    !isBlocked &&
    racha &&
    (isEdit ? event : true) &&
    (pixQuery.data !== undefined || racha.role === "PLAYER");

  return {
    mode: isEdit ? ("edit" as const) : ("create" as const),
    racha: canEdit ? racha : undefined,
    event: canEdit && isEdit ? event : undefined,
    pixKey: initialEventPixKey(
      isEdit ? event : undefined,
      pixQuery.data?.pixKey ?? null
    ),
    isLoading: isPending || isBlocked,
    retry: () => {
      void refetch();
      if (isEdit) void eventsQuery.refetch();
      if (pixQuery.isError) void pixQuery.refetch();
    },
    isRetrying:
      isRefetching || eventsQuery.isRefetching || pixQuery.isRefetching,
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
  const { setEventPixKey } = useSetEventPixKey(racha.id);
  const hasRachaAccess = useHasRachaAccess(racha.id);
  const { mode: pixMode, openConfirmEmail } = usePixKeyMode(racha.role);
  // criado o Evento, uma nova tentativa só refaz a chave: criar de novo duplicaria
  const createdEventId = useRef<string | null>(null);
  // espelho do ref para renderizar: Evento criado e Salvar ainda não concluído mantém o formulário sujo
  const [hasCreatedEvent, setHasCreatedEvent] = useState(false);
  const savedPixKey = editor.pixKey;

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
  const [pixText, setPixText] = useState(savedPixKey);
  const [pixRefusedText, setPixRefusedText] = useState<string | null>(null);
  const [failedValues, setFailedValues] = useState<TEventForm | null>(null);
  const [failedPixText, setFailedPixText] = useState("");
  const [saveFailureReason, setSaveFailureReason] = useState<
    | "generic"
    | "past_date"
    | "spot_limit_below_occupancy"
    | "event_month_locked"
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
  // a chave só vale com o Pago ligado: fechado, o campo some e o que foi digitado fica de lado
  const canEditPix = pixMode === "edit" && values.isPaid;
  const pixInput = checkPixKeyInput(pixText);
  const pixError = !canEditPix
    ? undefined
    : pixInput.isInvalid || pixRefusedText === pixText
      ? PIX_KEY_INVALID
      : undefined;
  const isPixChanged =
    canEditPix && !pixInput.isInvalid && pixInput.key !== savedPixKey;
  const isDirty =
    !isSameEvent(values, initial) || isPixChanged || hasCreatedEvent;

  const failureMessage =
    failedValues !== null &&
    !isSaving &&
    isSameEvent(failedValues, values) &&
    failedPixText === pixText
      ? saveFailureReason === "past_date"
        ? EVENT_START_PAST
        : saveFailureReason === "spot_limit_below_occupancy"
          ? ATTENDANCE_SPOT_LIMIT_BELOW_OCCUPANCY
          : saveFailureReason === "event_month_locked"
            ? ATTENDANCE_EVENT_MONTH_LOCKED
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

  const markFailed = () => {
    setFailedValues(values);
    setFailedPixText(pixText);
  };

  const showFreshSpotLimitError = async () => {
    const userId = session?.userId;
    if (!userId) {
      markFailed();
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
          markFailed();
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
        markFailed();
        return;
      }
      const floor = spotLimitFloor(freshEvent.outfieldPerTeam);
      setOutfieldPerTeam(freshEvent.outfieldPerTeam);
      if (values.spotLimit === null || values.spotLimit >= floor) {
        markFailed();
      }
    } catch (reloadError) {
      if (!isNoAccessError(reloadError)) markFailed();
    }
  };

  const persist = async (input: TEventInput) => {
    setIsSaving(true);
    try {
      let eventId = event?.id ?? createdEventId.current;
      if (eventId) await updateEvent(input, eventId);
      else {
        eventId = await createEvent(input);
        createdEventId.current = eventId;
        setHasCreatedEvent(true);
      }
      // se a chave falhar, o Evento já foi gravado: o formulário segue sujo e o
      // próximo Salvar repete o update com os valores atuais (idempotente) e a chave
      if (isPixChanged && eventId) {
        await setEventPixKey({ eventId, key: pixInput.key });
      }
      showToast(RACHA_SAVED, "success");
      setLeaveMode("home");
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "not_allowed" || error.message === "not_owner")
      ) {
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
        markFailed();
        return;
      }
      if (
        error instanceof Error &&
        error.message === "spot_limit_below_occupancy"
      ) {
        setSaveFailureReason("spot_limit_below_occupancy");
        markFailed();
        return;
      }
      if (error instanceof Error && error.message === "event_month_locked") {
        setSaveFailureReason("event_month_locked");
        markFailed();
        return;
      }
      if (error instanceof Error && error.message === "invalid_pix_key") {
        setPixRefusedText(pixText);
        return;
      }
      if (error instanceof Error && error.message === "email_not_verified") {
        // o campo passa a travado com o aviso do Perfil
        void queryClient.invalidateQueries({
          queryKey: profileKey(session?.userId),
        });
        return;
      }
      setSaveFailureReason("generic");
      markFailed();
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
    const input: TEventInput = {
      startsOn,
      kickoffHour: result.data.kickoffHour,
      kickoffMinute: result.data.kickoffMinute,
      place: result.data.place,
      isPaid: result.data.isPaid,
      price: result.data.isPaid ? result.data.price : null,
      spotLimit: result.data.spotLimit,
      payerTarget: result.data.isPaid ? result.data.payerTarget : null,
    };
    if (event?.isPaid && !input.isPaid) {
      Alert.alert(
        "Tornar evento grátis?",
        "Se houver pagamentos registrados neste evento, eles serão desfeitos no app. Créditos usados na diária voltarão ao saldo com a validade original. O app não devolve dinheiro: o Dono ou Admin precisa devolver por fora os valores recebidos.",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Tornar grátis", onPress: () => void persist(input) },
        ],
        { cancelable: false }
      );
      return;
    }
    void persist(input);
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
      payerTarget: messageFor(issues, "payerTarget"),
    },
    pixField: {
      mode: pixMode,
      value: pixText,
      error: pixError,
      hint: pixInput.type
        ? `${pixKeyTypeHint(pixKeyTypeLabel(pixInput.type))} ${PIX_EVENT_HINT}`
        : PIX_EVENT_HINT,
      onChangeText: setPixText,
      onConfirmEmail: openConfirmEmail,
    },
    isSaving,
    isDatePickerOpen,
    today: nowCivil.slice(0, 10),
    isDirty,
    canSave: parsed.success && isDirty && !pixError,
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
    setPayerTargetText: (text: string) =>
      setValues((current) => ({
        ...current,
        payerTarget: digitsOrNull(text),
      })),
    save,
  };
}
