import { BottomSheet, Button, Text } from "@/ui/components";
import { useAssumeEventConductionScreen } from "./use-assume-event-conduction-screen";

export const AssumeEventConductionScreen = () => {
  const { isMissing, canAssume, isAssuming, failureMessage, confirm, cancel } =
    useAssumeEventConductionScreen();

  if (isMissing || !canAssume) return null;

  return (
    <BottomSheet
      title="Assumir condução?"
      supporting={
        <Text>
          Você assume a condução do evento em curso no lugar do Condutor atual.
          Isso permite editar e encerrar o evento, sem iniciar uma partida.
        </Text>
      }
      hasCloseButton={false}
      isBusy={isAssuming}
    >
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button
        title="Assumir condução"
        isLoading={isAssuming}
        onPress={confirm}
      />
      <Button
        title="Voltar"
        preset="outline"
        isDisabled={isAssuming}
        onPress={cancel}
      />
    </BottomSheet>
  );
};
