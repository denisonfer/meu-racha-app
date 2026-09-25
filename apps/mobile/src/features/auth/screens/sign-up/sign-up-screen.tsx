import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Screen,
  ScreenFooter,
  StepIndicator,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { useSignUp } from "../../hooks/use-sign-up";
import { usernameAvailableQuery } from "../../hooks/use-username-available";
import {
  signUpSchema,
  stepFields,
  TSignUpForm,
  TSignUpFormInput,
} from "./sign-up-schema";
import { StepAccount, StepProfile, StepTerms } from "./steps";

const TOTAL_STEPS = stepFields.length;

export const SignUpScreen = () => {
  const [step, setStep] = useState(0);
  const { signUp, isPending, error } = useSignUp();
  const queryClient = useQueryClient();

  const { control, handleSubmit, trigger, getValues, setError } = useForm<
    TSignUpFormInput,
    unknown,
    TSignUpForm
  >({
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

  const isLastStep = step === TOTAL_STEPS - 1;

  async function handleContinue() {
    const fields = stepFields[step];
    if (!fields) return;

    const isStepValid = await trigger([...fields]);
    if (!isStepValid) return;

    if (step === 0) {
      const username = getValues("username");
      const isAvailable = await queryClient
        .query(usernameAvailableQuery(username))
        .catch(() => true);

      if (!isAvailable) {
        setError("username", { message: "Esse username já está em uso" });
        return;
      }
    }

    if (isLastStep) {
      handleSubmit((values) => signUp(values))();
      return;
    }
    setStep((current) => current + 1);
  }

  function handleGoBack() {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
  }

  return (
    <Screen title="Cadastro" canGoBack onGoBack={handleGoBack} isScrollable>
      <Stack.Screen options={{ gestureEnabled: step === 0 }} />
      <View style={styles.content}>
        <StepIndicator total={TOTAL_STEPS} current={step + 1} />

        {step === 0 ? <StepAccount control={control} /> : null}
        {step === 1 ? <StepProfile control={control} /> : null}
        {step === 2 ? <StepTerms control={control} /> : null}
      </View>

      <ScreenFooter>
        {error ? (
          <Text preset="small" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button
          title={isLastStep ? "Criar conta" : "Continuar"}
          isLoading={isPending}
          onPress={handleContinue}
        />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: theme.space[24],
    paddingTop: theme.space[16],
  },
});
