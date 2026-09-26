import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, Screen, ScreenFooter, StepIndicator } from "@/ui/components";
import { theme } from "@/ui/theme";
import { StepAccount, StepProfile, StepTerms } from "./steps";
import { useSignUpScreen } from "./use-sign-up-screen";

export const SignUpScreen = () => {
  const {
    control,
    step,
    totalSteps,
    isFirstStep,
    isLastStep,
    isPending,
    goForward,
    goBack,
  } = useSignUpScreen();

  return (
    <Screen title="Cadastro" canGoBack onGoBack={goBack} isScrollable>
      <Stack.Screen options={{ gestureEnabled: isFirstStep }} />

      <View style={styles.content}>
        <StepIndicator total={totalSteps} current={step + 1} />

        {step === 0 ? <StepAccount control={control} /> : null}
        {step === 1 ? <StepProfile control={control} /> : null}
        {step === 2 ? <StepTerms control={control} /> : null}
      </View>

      <ScreenFooter>
        <Button
          title={isLastStep ? "Criar conta" : "Continuar"}
          isLoading={isPending}
          onPress={goForward}
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
