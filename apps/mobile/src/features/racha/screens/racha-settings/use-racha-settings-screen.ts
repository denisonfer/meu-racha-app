import { isSameRules } from "@meu-racha/domain";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useToast } from "@/ui/components";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useRacha } from "../../hooks/use-racha";
import { useRachaForm } from "../../hooks/use-racha-form";
import { useUpdateRacha } from "../../hooks/use-update-racha";
import { TRachaForm } from "../../racha-form-schema";
import { TRacha } from "../../racha-types";
import {
  DISCARD_CHANGES_TITLE,
  LINE_TOO_BIG_FOR_SPOT_LIMIT,
  NAME_REQUIRED_TO_SAVE,
  NOT_OWNER,
  RACHA_SAVED,
  SAVE_RACHA_FAILED,
} from "../../utils/racha-messages";

type TSaveFailureReason = "generic" | "spot_limit_fits_two_teams";

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
  const { updateRacha } = useUpdateRacha(racha.id);
  const hasRachaAccess = useHasRachaAccess(racha.id);

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

  const isDirty =
    values.name.trim() !== initial.name ||
    !isSameRules(values.rules, initial.rules);

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
        await updateRacha({ name: valid.name, rules: valid.rules });
      } catch (error) {
        if (error instanceof Error && error.message === "not_allowed") {
          setIsLeaving(true);
          if (await hasRachaAccess()) showToast(NOT_OWNER);
        } else {
          setFailedValues(values);
          setSaveFailureReason(
            error instanceof Error &&
              error.message === "spot_limit_fits_two_teams"
              ? "spot_limit_fits_two_teams"
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
      : SAVE_RACHA_FAILED
    : null;

  return {
    form,
    isSaving,
    isDirty,
    failureMessage,
    save,
    openDelete: () => router.push(`/racha/${racha.id}/delete`),
  };
}
