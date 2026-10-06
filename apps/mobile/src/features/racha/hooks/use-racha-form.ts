import { zodResolver } from "@hookform/resolvers/zod";
import { formatRulesSummary, TRachaRules } from "@meu-racha/domain";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { TextInput } from "react-native";
import { TCreateRachaFormProps } from "../components/create-racha-form";
import { TRachaFormProps } from "../components/racha-form";
import {
  buildCreateRachaFormSchema,
  buildRachaFormSchema,
  TCreateRachaForm,
  TRachaForm,
} from "../racha-form-schema";

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

  const rules = useWatch({ control, name: "rules" });

  const setRule = <K extends keyof TRachaRules>(
    key: K,
    value: TRachaRules[K]
  ) => {
    setValue("rules", { ...getValues("rules"), [key]: value });
    clearErrors("rules");
  };

  const values: TRachaForm = { name, rules };

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
    rules,
    summary: formatRulesSummary(rules),
    setRule,
    matchDurationError: errors.rules?.matchDurationMin?.message,
    yellowOutError: errors.rules?.yellowOutMin?.message,
    isRulesExpanded,
    toggleRules: () => setIsRulesExpanded((isOpen) => !isOpen),
  };

  return { form, values, isSubmitting, isSubmitSuccessful, submit };
}

export function useCreateRachaForm(options: {
  defaultValues: TCreateRachaForm;
  nameRequiredMessage: string;
  isRulesInitiallyExpanded: boolean;
}) {
  const { defaultValues, nameRequiredMessage, isRulesInitiallyExpanded } =
    options;

  const nameRef = useRef<TextInput>(null);
  const placeRef = useRef<TextInput>(null);
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
  } = useForm<TCreateRachaForm>({
    resolver: zodResolver(buildCreateRachaFormSchema(nameRequiredMessage)),
    defaultValues,
    reValidateMode: "onSubmit",
  });

  const name = useWatch({ control, name: "name" });
  useEffect(() => clearErrors("name"), [name, clearErrors]);

  const place = useWatch({ control, name: "place" });
  useEffect(() => clearErrors("place"), [place, clearErrors]);

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

  const values: TCreateRachaForm = { name, place, minAge, rules };

  const submit = (onValid: (values: TCreateRachaForm) => Promise<void>) => {
    if (isSubmitting) return;
    handleSubmit(onValid, (invalid) => {
      if (invalid.name) nameRef.current?.focus();
      else if (invalid.place) placeRef.current?.focus();
      else if (invalid.rules) setIsRulesExpanded(true);
    })().catch(() => {});
  };

  const form: TCreateRachaFormProps = {
    control,
    nameRef,
    placeRef,
    minAge,
    setMinAge,
    minAgeError: errors.minAge?.message,
    rules,
    summary: formatRulesSummary(rules),
    setRule,
    matchDurationError: errors.rules?.matchDurationMin?.message,
    yellowOutError: errors.rules?.yellowOutMin?.message,
    isRulesExpanded,
    toggleRules: () => setIsRulesExpanded((isOpen) => !isOpen),
  };

  return { form, values, isSubmitting, isSubmitSuccessful, submit };
}
