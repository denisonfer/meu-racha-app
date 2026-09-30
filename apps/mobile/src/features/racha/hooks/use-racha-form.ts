import { zodResolver } from "@hookform/resolvers/zod";
import { formatRulesSummary, TRachaRules } from "@meu-racha/domain";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { TextInput } from "react-native";
import { TRachaFormProps } from "../components/racha-form";
import { buildRachaFormSchema, TRachaForm } from "../racha-form-schema";

export function useRachaForm(options: {
  defaultValues: TRachaForm;
  nameRequiredMessage: string;
  isRulesInitiallyExpanded: boolean;
}) {
  const { defaultValues, nameRequiredMessage, isRulesInitiallyExpanded } =
    options;

  const nameRef = useRef<TextInput>(null);
  const [isRulesExpanded, setIsRulesExpanded] = useState(
    isRulesInitiallyExpanded
  );

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<TRachaForm>({
    resolver: zodResolver(buildRachaFormSchema(nameRequiredMessage)),
    defaultValues,
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

  const values: TRachaForm = { name, minAge, rules };

  const submit = (onValid: (values: TRachaForm) => Promise<void>) => {
    if (isSubmitting) return;
    handleSubmit(onValid, (invalid) => {
      if (invalid.name) nameRef.current?.focus();
      else if (invalid.rules) setIsRulesExpanded(true);
    })().catch(() => {});
  };

  const form: TRachaFormProps = {
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
  };

  return { form, values, isSubmitting, isSubmitSuccessful, submit };
}
