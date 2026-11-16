import {
  Button,
  NoticeBanner,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { CreateRachaForm } from "../../components/create-racha-form";
import { PRO_LEARN } from "../../utils/racha-messages";
import { useCreateRachaScreen } from "./use-create-racha-screen";

export const CreateRachaScreen = () => {
  const {
    form,
    isCreating,
    isBlocked,
    blockedMessage,
    canLearnPro,
    openPro,
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
        {canLearnPro ? (
          <Button preset="secondary" title={PRO_LEARN} onPress={openPro} />
        ) : (
          <Button
            title="Criar racha"
            accessibilityLabel={isCreating ? "Criando racha" : "Criar racha"}
            isLoading={isCreating}
            isDisabled={isBlocked}
            onPress={submit}
          />
        )}
      </ScreenFooter>
    </Screen>
  );
};
