import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
  const [isAdvancing, setIsAdvancing] = useState(false);
  // o estado só vale no próximo render: dois toques seguidos passariam os dois
  const isAdvancingRef = useRef(false);
  const { signUp, isPending } = useSignUp();
  const queryClient = useQueryClient();

  const { control, handleSubmit, trigger, getValues, setValue } = useForm<
    TSignUpFormInput,
    unknown,
    TSignUpForm
  >({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      playsAs: "OUTFIELD",
      primaryPosition: null,
      secondaryPosition: null,
      photo: null,
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

  async function advance() {
    const fields = stepFields[step];
    if (!fields) return;

    const isStepValid = await trigger([...fields]);
    if (!isStepValid) return;

    // A mensagem de e-mail já usado aparece ao vivo, no passo da conta.
    const taken = await findTakenFields(queryClient, fields, (field) =>
      getValues(field)
    );
    if (taken.length > 0) return;

    if (isLastStep) {
      await handleSubmit(
        (values) =>
          signUp(values, { onSuccess: () => router.replace("/sign-in") }),
        // o zod valida o formulário todo: o erro pode ser de outra etapa
        (errors) => {
          const target = stepFields.findIndex((group) =>
            group.some((field) => field in errors)
          );
          if (target >= 0) setStep(target);
        }
      )();
      return;
    }

    setStep((current) => current + 1);
  }

  async function goForward() {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    setIsAdvancing(true);
    try {
      await advance();
    } finally {
      isAdvancingRef.current = false;
      setIsAdvancing(false);
    }
  }

  const recoverPassword = (email: string) =>
    router.push({ pathname: "/forgot-password", params: { email } });

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
    isAdvancing,
    goForward,
    recoverPassword,
    goBack,
  };
}
