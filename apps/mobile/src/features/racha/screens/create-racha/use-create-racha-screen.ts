import { DEFAULT_MIN_AGE, DEFAULT_RACHA_RULES } from "@meu-racha/domain";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Platform } from "react-native";
import { useSession } from "@/features/auth";
import {
  planKey,
  PRO_IOS_UNAVAILABLE,
  purchaseAvailable,
  useMyPlan,
} from "@/features/plan";
import { useCreateRacha } from "../../hooks/use-create-racha";
import { useCreateRachaForm } from "../../hooks/use-racha-form";
import { TCreateRachaForm } from "../../racha-form-schema";
import {
  CREATE_RACHA_FAILED,
  isPlanOwnerLimit,
  NAME_NOT_ALLOWED,
  NAME_REQUIRED,
  PLAN_OWNER_LIMIT,
  PLAN_OWNER_LIMIT_FREE,
  planOwnerOver,
  yellowShorterThanMatch,
} from "../../utils/racha-messages";

export function useCreateRachaScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: plan } = useMyPlan();
  const { createRacha, errorCode } = useCreateRacha();
  const canBuyPro = purchaseAvailable();

  const { form, isSubmitting, isSubmitSuccessful, submit, rejectName } =
    useCreateRachaForm({
      defaultValues: {
        name: "",
        place: "",
        minAge: DEFAULT_MIN_AGE,
        rules: DEFAULT_RACHA_RULES,
      },
      nameRequiredMessage: NAME_REQUIRED,
      isRulesInitiallyExpanded: false,
    });

  const isBlocked =
    !isSubmitSuccessful &&
    (plan?.canCreateRacha === false || isPlanOwnerLimit(errorCode));

  const blockedMessage = canBuyPro
    ? (plan?.ownedRachaCount ?? 0) > 1
      ? planOwnerOver(plan?.ownedRachaCount ?? 0)
      : PLAN_OWNER_LIMIT_FREE
    : Platform.OS === "ios"
      ? `${PLAN_OWNER_LIMIT_FREE}\n${PRO_IOS_UNAVAILABLE}`
      : PLAN_OWNER_LIMIT;

  const onValid = async (values: TCreateRachaForm) => {
    let id: string;
    try {
      ({ id } = await createRacha(values));
      if (session) {
        void queryClient.invalidateQueries({
          queryKey: planKey(session.userId),
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message === "name_not_allowed") {
        rejectName(NAME_NOT_ALLOWED);
        return;
      }
      throw error;
    }
    router.replace(`/racha/${id}`);
  };

  return {
    form,
    isCreating: isSubmitting,
    isBlocked,
    blockedMessage,
    // no teto com compra disponível, "Conhecer o Pro" toma o lugar do botão morto
    canLearnPro: isBlocked && canBuyPro,
    openPro: () => router.push("/settings/pro"),
    failureMessage:
      errorCode &&
      !isPlanOwnerLimit(errorCode) &&
      errorCode !== "name_not_allowed" &&
      !isSubmitting
        ? errorCode === "yellow_shorter_than_match"
          ? yellowShorterThanMatch(form.rules.matchDurationMin ?? 0)
          : CREATE_RACHA_FAILED
        : null,
    submit: () => {
      if (isBlocked) return;
      submit(onValid);
    },
  };
}
