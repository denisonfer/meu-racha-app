import { PRICE_MAX, PRICE_MIN, spotLimitFloor } from "@meu-racha/domain";
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
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useRacha, rachaKey } from "../../hooks/use-racha";
import { useUpdateRachaLogistics } from "../../hooks/use-update-racha-logistics";
import { rachaApi } from "../../racha-api";
import { TRacha, TRachaLogistics } from "../../racha-types";
import { isNoAccessError } from "../../utils/no-access";
import {
  DISCARD_CHANGES_TITLE,
  LOGISTICS_NOT_ALLOWED,
  RACHA_SAVED,
  SAVE_RACHA_FAILED,
} from "../../utils/racha-messages";
import { buildLogisticsSchema, TLogisticsForm } from "./logistics-schema";

const digitsOrNull = (text: string) => {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};

// 0 e 10000 não podem ficar escondidos: o banco recusa, e o campo some com o Pago
const priceWithinRange = (value: number | null) =>
  value !== null && value >= PRICE_MIN && value <= PRICE_MAX;

const isSameLogistics = (a: TLogisticsForm, b: TLogisticsForm) =>
  a.place.trim() === b.place.trim() &&
  a.weekday === b.weekday &&
  a.kickoffHour === b.kickoffHour &&
  a.kickoffMinute === b.kickoffMinute &&
  a.minAge === b.minAge &&
  a.isPaid === b.isPaid &&
  a.price === b.price &&
  a.monthlyPrice === b.monthlyPrice &&
  a.spotLimit === b.spotLimit &&
  a.payerTarget === b.payerTarget;

const messageFor = (
  issues: { path: PropertyKey[]; message: string }[],
  key: string
) => issues.find((issue) => issue.path[0] === key)?.message;

export function useLogisticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data: racha,
    isPending,
    error,
    fetchStatus,
    refetch,
    isRefetching,
  } = useRacha(id);
  const isNoAccess = useLeaveOnNoAccess(error, fetchStatus, id);

  // cache velho no remount não expulsa um Admin: só com a consulta parada
  const isPlayer = racha?.role === "PLAYER" && fetchStatus === "idle";
  const isStalePlayer = racha?.role === "PLAYER" && fetchStatus !== "idle";

  useEffect(() => {
    if (isPlayer) router.dismissTo(`/racha/${id}`);
  }, [isPlayer, id]);

  return {
    racha: isPlayer || isStalePlayer || isNoAccess ? undefined : racha,
    isLoading: isPending || isNoAccess || isPlayer || isStalePlayer,
    retry: () => void refetch(),
    isRetrying: isRefetching,
  };
}

export function useLogisticsForm(racha: TRacha) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const showToast = useToast();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { updateRachaLogistics } = useUpdateRachaLogistics(racha.id);
  const hasRachaAccess = useHasRachaAccess(racha.id);

  // uma recarga do Racha no meio da edição não pode reescrever o que foi digitado
  const [initial] = useState<TLogisticsForm>(() => ({
    place: racha.place,
    weekday: racha.weekday,
    kickoffHour: racha.kickoffHour,
    kickoffMinute: racha.kickoffMinute,
    minAge: racha.minAge,
    isPaid: racha.isPaid,
    price: racha.price,
    monthlyPrice: racha.monthlyPrice,
    spotLimit: racha.spotLimit,
    payerTarget: racha.payerTarget,
  }));
  const [values, setValues] = useState(initial);
  const [outfieldPerTeam, setOutfieldPerTeam] = useState(
    racha.rules.outfieldPerTeam
  );
  const [failedValues, setFailedValues] = useState<TLogisticsForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [leaveMode, setLeaveMode] = useState<"back" | "home" | null>(null);

  const parsed = buildLogisticsSchema(outfieldPerTeam).safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const isDirty = !isSameLogistics(values, initial);

  const failureMessage =
    failedValues !== null && !isSaving && isSameLogistics(failedValues, values)
      ? SAVE_RACHA_FAILED
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
    if (leaveMode === "back") router.back();
    if (leaveMode === "home") router.dismissTo(`/racha/${racha.id}`);
  }, [leaveMode, racha.id]);

  const showFreshSpotLimitError = async () => {
    const userId = session?.userId;
    if (!userId) {
      setFailedValues(values);
      return;
    }
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: rachaKey(racha.id),
        queryFn: () => rachaApi.getRacha(racha.id, userId),
        staleTime: 0,
      });
      const floor = spotLimitFloor(fresh.rules.outfieldPerTeam);
      setOutfieldPerTeam(fresh.rules.outfieldPerTeam);
      // a linha recarregada ainda comporta o número: não é erro deste campo
      if (values.spotLimit === null || values.spotLimit >= floor) {
        setFailedValues(values);
      }
    } catch (reloadError) {
      if (!isNoAccessError(reloadError)) setFailedValues(values);
    }
  };

  const persist = async (logistics: TRachaLogistics) => {
    setIsSaving(true);
    try {
      await updateRachaLogistics(logistics);
      showToast(RACHA_SAVED, "success");
      setLeaveMode("back");
    } catch (error) {
      if (error instanceof Error && error.message === "not_allowed") {
        const stillMember = await hasRachaAccess();
        // quem perdeu o Racha sai pelo useLeaveOnNoAccess, sem este toast
        if (stillMember) {
          showToast(LOGISTICS_NOT_ALLOWED);
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
      setFailedValues(values);
    } finally {
      setIsSaving(false);
    }
  };

  const save = () => {
    if (isSaving) return;
    const result = buildLogisticsSchema(outfieldPerTeam).safeParse(values);
    if (!result.success) return;
    const logistics: TRachaLogistics = {
      ...result.data,
      price: result.data.isPaid ? result.data.price : null,
      monthlyPrice: result.data.isPaid ? result.data.monthlyPrice : null,
      payerTarget: result.data.isPaid ? result.data.payerTarget : null,
    };
    if (initial.isPaid && !logistics.isPaid) {
      Alert.alert(
        "Tornar racha grátis?",
        "O valor da diária, o valor mensal e a Meta serão apagados do Racha. Eventos já criados mantêm suas configurações de Pago, diária e Meta; a mensalidade é uma configuração do Racha. Passes mensais já registrados e saldos de Crédito dos membros permanecem.",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Tornar grátis", onPress: () => void persist(logistics) },
        ],
        { cancelable: false }
      );
      return;
    }
    void persist(logistics);
  };

  return {
    values,
    errors: {
      place: messageFor(issues, "place"),
      slot: messageFor(issues, "slot"),
      hour: messageFor(issues, "kickoffHour"),
      minute: messageFor(issues, "kickoffMinute"),
      minAge: messageFor(issues, "minAge"),
      price: messageFor(issues, "price"),
      monthlyPrice: messageFor(issues, "monthlyPrice"),
      spotLimit: messageFor(issues, "spotLimit"),
      payerTarget: messageFor(issues, "payerTarget"),
    },
    isSaving,
    isDirty,
    canSave: parsed.success && isDirty,
    failureMessage,
    setPlace: (place: string) =>
      setValues((current) => ({ ...current, place })),
    selectWeekday: (day: number) =>
      setValues((current) =>
        current.weekday === day
          ? {
              ...current,
              weekday: null,
              kickoffHour: null,
              kickoffMinute: null,
            }
          : { ...current, weekday: day }
      ),
    setHour: (kickoffHour: number | null) =>
      setValues((current) => ({ ...current, kickoffHour })),
    setMinute: (kickoffMinute: number | null) =>
      setValues((current) => ({ ...current, kickoffMinute })),
    setMinAge: (minAge: number | null) =>
      setValues((current) => ({ ...current, minAge })),
    // ligar não mexe nos números; desligar devolve o gravado se o digitado
    // está fora de 1–9999, senão o Salvar trava num erro que a tela escondeu
    setIsPaid: (isPaid: boolean) =>
      setValues((current) => ({
        ...current,
        isPaid,
        price:
          isPaid || priceWithinRange(current.price) || current.price === null
            ? current.price
            : initial.price,
        monthlyPrice:
          isPaid ||
          priceWithinRange(current.monthlyPrice) ||
          current.monthlyPrice === null
            ? current.monthlyPrice
            : initial.monthlyPrice,
      })),
    setPriceText: (text: string) =>
      setValues((current) => ({ ...current, price: digitsOrNull(text) })),
    setMonthlyPriceText: (text: string) =>
      setValues((current) => ({
        ...current,
        monthlyPrice: digitsOrNull(text),
      })),
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
