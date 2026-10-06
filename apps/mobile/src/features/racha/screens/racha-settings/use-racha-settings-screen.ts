import { isSameRules } from "@meu-racha/domain";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useToast } from "@/ui/components";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { openEventsKey, useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import { useRachaForm } from "../../hooks/use-racha-form";
import { useUpdateRacha } from "../../hooks/use-update-racha";
import { rachaApi } from "../../racha-api";
import { TRachaForm } from "../../racha-form-schema";
import { TOpenEvent, TRacha } from "../../racha-types";
import {
  DELETE_RACHA_FAILED,
  DELETE_LOCKED,
  DISCARD_CHANGES_TITLE,
  LINE_TOO_BIG_FOR_SPOT_LIMIT,
  MOTOR_LOCKED,
  NAME_REQUIRED_TO_SAVE,
  NOT_OWNER,
  RACHA_SAVED,
  SAVE_RACHA_FAILED,
  yellowShorterThanMatch,
} from "../../utils/racha-messages";

type TSaveFailureReason =
  | "generic"
  | "spot_limit_fits_two_teams"
  | "event_active"
  | "yellow_shorter_than_match";

function hasActiveEvent(events: TOpenEvent[] | undefined): boolean {
  return Boolean(events?.some((event) => event.status === "active"));
}

export function useRachaSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: racha, isPending, refetch, isRefetching } = useRacha(id);

  const isNotOwner = Boolean(racha) && racha?.role !== "OWNER";

  useEffect(() => {
    if (isNotOwner) router.dismissTo(`/racha/${id}`);
  }, [isNotOwner, id]);

  return {
    racha: isNotOwner ? undefined : racha,
    isLoading: isPending || isNotOwner,
    retry: () => void refetch(),
    isRetrying: isRefetching,
  };
}

export function useRachaSettingsForm(racha: TRacha) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const { updateRacha } = useUpdateRacha(racha.id);
  const hasRachaAccess = useHasRachaAccess(racha.id);
  const {
    data: openEvents,
    fetchStatus,
    isFetchedAfterMount,
  } = useOpenEvents(racha.id);

  // uma resposta desta tela mantém a trava durante refetch, sem confiar no cache inicial
  const isMotorLocked =
    hasActiveEvent(openEvents) &&
    (fetchStatus === "idle" || isFetchedAfterMount);

  // uma recarga do Racha no meio da edição não pode reescrever o que foi digitado
  const [initial] = useState<TRachaForm>(() => ({
    name: racha.name,
    rules: racha.rules,
  }));
  const [failedValues, setFailedValues] = useState<TRachaForm | null>(null);
  const [saveFailureReason, setSaveFailureReason] =
    useState<TSaveFailureReason | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const {
    form,
    values,
    isSubmitting: isSaving,
    submit,
  } = useRachaForm({
    defaultValues: initial,
    nameRequiredMessage: NAME_REQUIRED_TO_SAVE,
    isRulesInitiallyExpanded: true,
  });

  const isNameDirty = values.name.trim() !== initial.name;
  const isRulesDirty = !isSameRules(values.rules, initial.rules);
  // com o motor travado, só o nome entra no Salvar
  const isDirty = isMotorLocked ? isNameDirty : isNameDirty || isRulesDirty;

  // o erro vale para os valores que falharam: some quando um campo muda
  const hasSaveFailed =
    failedValues !== null &&
    !isSaving &&
    failedValues.name === values.name &&
    isSameRules(failedValues.rules, values.rules);

  // só com a tela em foco: com a folha de excluir por cima, a exclusão precisa
  // conseguir remover esta tela mesmo com mudança pendente
  usePreventRemove(
    isFocused && !isLeaving && (isDirty || isSaving),
    ({ data }) => {
      // dismissTo (ex.: depois de excluir o racha) não é um voltar da pessoa: sem alerta
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

  // sair depois de salvar: o bloqueio só cai no render seguinte
  useEffect(() => {
    if (isLeaving) router.back();
  }, [isLeaving]);

  const save = () =>
    submit(async (valid) => {
      try {
        await updateRacha({
          name: valid.name,
          // com o motor travado, manda o que já estava: o gatilho só olha o que mudou
          rules: isMotorLocked ? initial.rules : valid.rules,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "not_allowed") {
          setIsLeaving(true);
          if (await hasRachaAccess()) showToast(NOT_OWNER);
        } else {
          setFailedValues(values);
          const code = error instanceof Error ? error.message : "";
          setSaveFailureReason(
            code === "spot_limit_fits_two_teams"
              ? "spot_limit_fits_two_teams"
              : code === "event_active"
                ? "event_active"
                : code === "yellow_shorter_than_match"
                  ? "yellow_shorter_than_match"
                  : "generic"
          );
        }
        return;
      }
      showToast(RACHA_SAVED, "success");
      setIsLeaving(true);
    });

  const failureMessage = hasSaveFailed
    ? saveFailureReason === "spot_limit_fits_two_teams"
      ? LINE_TOO_BIG_FOR_SPOT_LIMIT
      : saveFailureReason === "event_active"
        ? MOTOR_LOCKED
        : saveFailureReason === "yellow_shorter_than_match"
          ? yellowShorterThanMatch(failedValues?.rules.matchDurationMin ?? 0)
          : SAVE_RACHA_FAILED
    : null;

  const openDelete = async () => {
    if (isMotorLocked) return;
    // a trava pode ter nascido depois da última leitura
    let events: TOpenEvent[];
    try {
      events = await queryClient.fetchQuery({
        queryKey: openEventsKey(racha.id),
        queryFn: () => rachaApi.listOpenEvents(racha.id),
        staleTime: 0,
      });
    } catch {
      showToast(DELETE_RACHA_FAILED);
      return;
    }
    if (hasActiveEvent(events)) {
      showToast(DELETE_LOCKED);
      return;
    }
    router.push(`/racha/${racha.id}/delete`);
  };

  return {
    form,
    isSaving,
    isDirty,
    isMotorLocked,
    failureMessage,
    save,
    openDelete: () => void openDelete(),
  };
}
