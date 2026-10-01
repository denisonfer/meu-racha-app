import { DEFAULT_MIN_AGE, DEFAULT_RACHA_RULES } from "@meu-racha/domain";
import { router } from "expo-router";
import { useCreateRacha } from "../../hooks/use-create-racha";
import { useCreateRachaForm } from "../../hooks/use-racha-form";
import { useMyRachas } from "../../hooks/use-my-rachas";
import { TCreateRachaForm } from "../../racha-form-schema";
import {
  CREATE_RACHA_FAILED,
  isPlanOwnerLimit,
  NAME_REQUIRED,
  PLAN_OWNER_LIMIT,
} from "../../utils/racha-messages";

export function useCreateRachaScreen() {
  const { data: myRachas } = useMyRachas();
  const { createRacha, errorCode } = useCreateRacha();

  const { form, isSubmitting, isSubmitSuccessful, submit } = useCreateRachaForm(
    {
      defaultValues: {
        name: "",
        place: "",
        minAge: DEFAULT_MIN_AGE,
        rules: DEFAULT_RACHA_RULES,
      },
      nameRequiredMessage: NAME_REQUIRED,
      isRulesInitiallyExpanded: false,
    }
  );

  const isBlocked =
    !isSubmitSuccessful &&
    (Boolean(myRachas?.some((racha) => racha.role === "OWNER")) ||
      isPlanOwnerLimit(errorCode));

  const onValid = async (values: TCreateRachaForm) => {
    const { id } = await createRacha(values);
    router.replace(`/racha/${id}`);
  };

  return {
    form,
    isCreating: isSubmitting,
    isBlocked,
    blockedMessage: PLAN_OWNER_LIMIT,
    failureMessage:
      errorCode && !isPlanOwnerLimit(errorCode) && !isSubmitting
        ? CREATE_RACHA_FAILED
        : null,
    submit: () => {
      if (isBlocked) return;
      submit(onValid);
    },
  };
}
