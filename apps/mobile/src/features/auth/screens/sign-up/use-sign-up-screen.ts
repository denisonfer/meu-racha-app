import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSignUp } from "../../hooks/use-sign-up";
import {
  signUpSchema,
  stepFields,
  TSignUpForm,
  TSignUpFormInput,
} from "./sign-up-schema";
import { findTakenFields } from "../../utils/availability";

const TOTAL_STEPS = stepFields.length;

export function useSignUpScreen() {
  const [step, setStep] = useState(0);
  const { signUp, isPending } = useSignUp();
  const queryClient = useQueryClient();

  const { control, handleSubmit, trigger, getValues, setError, setValue } =
    useForm<TSignUpFormInput, unknown, TSignUpForm>({
      resolver: zodResolver(signUpSchema),
      defaultValues: {
        username: "",
        displayName: "",
        email: "",
        password: "",
        playsAs: "OUTFIELD",
        primaryPosition: null,
        secondaryPosition: null,
        birthDate: "",
        acceptedTerms: false,
      },
      mode: "onBlur",
    });

  const playsAs = useWatch({ control, name: "playsAs" });
  const primaryPosition = useWatch({ control, name: "primaryPosition" });

  useEffect(() => {
    if (playsAs === "GOALKEEPER") {
      setValue("primaryPosition", null);
      setValue("secondaryPosition", null);
      return;
    }

    if (primaryPosition === "ANY") setValue("secondaryPosition", null);
  }, [playsAs, primaryPosition, setValue]);

  const isFirstStep = step === 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  async function goForward() {
    const fields = stepFields[step];
    if (!fields) return;

    const isStepValid = await trigger([...fields]);
    if (!isStepValid) return;

    const taken = await findTakenFields(queryClient, fields, (field) =>
      getValues(field)
    );

    if (taken.length > 0) {
      taken.forEach(({ field, message }) => setError(field, { message }));
      return;
    }

    if (isLastStep) {
      handleSubmit((values) =>
        signUp(values, { onSuccess: () => router.replace("/sign-in") })
      )();
      return;
    }

    setStep((current) => current + 1);
  }

  function goBack() {
    if (isFirstStep) {
      if (router.canGoBack()) router.back();
      else router.replace("/sign-in");
      return;
    }

    setStep((current) => current - 1);
  }

  return {
    control,
    step,
    totalSteps: TOTAL_STEPS,
    isFirstStep,
    isLastStep,
    isPending,
    goForward,
    goBack,
  };
}
