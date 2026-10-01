import {
  Button,
  NoticeBanner,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { CreateRachaForm } from "../../components/create-racha-form";
import { useCreateRachaScreen } from "./use-create-racha-screen";

export const CreateRachaScreen = () => {
  const {
    form,
    isCreating,
    isBlocked,
    blockedMessage,
    failureMessage,
    submit,
  } = useCreateRachaScreen();

  return (
    <Screen title="Criar racha" canGoBack>
      <CreateRachaForm {...form} isNameAutoFocused isDisabled={isCreating} />

      <ScreenFooter>
        {isBlocked ? (
          <NoticeBanner tone="warning" text={blockedMessage} />
        ) : null}
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Criar racha"
          accessibilityLabel={isCreating ? "Criando racha" : "Criar racha"}
          isLoading={isCreating}
          isDisabled={isBlocked}
          onPress={submit}
        />
      </ScreenFooter>
    </Screen>
  );
};
