import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_MIN_AGE,
  DEFAULT_RACHA_RULES,
  formatRulesSummary,
  TRachaRules,
} from "@meu-racha/domain";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { TextInput } from "react-native";
import { useCreateRacha } from "../../hooks/use-create-racha";
import { useMyRachas } from "../../hooks/use-my-rachas";
import {
  CREATE_RACHA_FAILED,
  isPlanOwnerLimit,
  PLAN_OWNER_LIMIT,
} from "../../utils/racha-messages";
import { createRachaSchema, TCreateRachaForm } from "./create-racha-schema";

export function useCreateRachaScreen() {
  const nameRef = useRef<TextInput>(null);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const { data: myRachas } = useMyRachas();
  const { createRacha, errorCode } = useCreateRacha();

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<TCreateRachaForm>({
    resolver: zodResolver(createRachaSchema),
    defaultValues: {
      name: "",
      minAge: DEFAULT_MIN_AGE,
      rules: DEFAULT_RACHA_RULES,
    },
    reValidateMode: "onSubmit",
  });

  const name = useWatch({ control, name: "name" });
  useEffect(() => clearErrors("name"), [name, clearErrors]);

  const minAge = useWatch({ control, name: "minAge" });
  const setMinAge = (value: number | null) => {
    setValue("minAge", value);
    clearErrors("minAge");
  };

  const rules = useWatch({ control, name: "rules" });

  const setRule = <K extends keyof TRachaRules>(
    key: K,
    value: TRachaRules[K]
  ) => {
    setValue("rules", { ...getValues("rules"), [key]: value });
    clearErrors("rules");
  };

  const isBlocked =
    !isSubmitSuccessful &&
    (Boolean(myRachas?.some((racha) => racha.role === "OWNER")) ||
      isPlanOwnerLimit(errorCode));

  const onValid = async (values: TCreateRachaForm) => {
    const { id } = await createRacha(values);
    router.replace(`/racha/${id}`);
  };

  const submit = () => {
    if (isBlocked || isSubmitting) return;
    handleSubmit(onValid, (invalid) => {
      if (invalid.name) nameRef.current?.focus();
      else if (invalid.rules) setIsRulesExpanded(true);
    })().catch(() => {});
  };

  return {
    control,
    nameRef,
    minAge,
    setMinAge,
    minAgeError: errors.minAge?.message,
    rules,
    summary: formatRulesSummary(rules),
    setRule,
    matchDurationError: errors.rules?.matchDurationMin?.message,
    isRulesExpanded,
    toggleRules: () => setIsRulesExpanded((isOpen) => !isOpen),
    isCreating: isSubmitting,
    isBlocked,
    blockedMessage: PLAN_OWNER_LIMIT,
    failureMessage:
      errorCode && !isPlanOwnerLimit(errorCode) && !isSubmitting
        ? CREATE_RACHA_FAILED
        : null,
    submit,
  };
}
