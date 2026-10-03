import { BottomSheet, Button, Text } from "@/ui/components";
import {
  SORT_ASSUME_UPCOMING_STAY,
  SORT_ASSUME_UPCOMING_TITLE,
  sortAssumeUpcomingText,
} from "../../utils/racha-messages";
import { useAssumeEventConductionScreen } from "./use-assume-event-conduction-screen";

export const AssumeEventConductionScreen = () => {
  const {
    isMissing,
    canAssume,
    isUpcoming,
    conductorName,
    isAssuming,
    failureMessage,
    confirm,
    cancel,
  } = useAssumeEventConductionScreen();

  if (isMissing || !canAssume) return null;

  return (
    <BottomSheet
      title={isUpcoming ? SORT_ASSUME_UPCOMING_TITLE : "Assumir condução?"}
      supporting={
        <Text>
          {isUpcoming
            ? sortAssumeUpcomingText(conductorName ?? "Outra pessoa")
            : "Você assume a condução do evento em curso no lugar do Condutor atual. Isso permite editar e encerrar o evento, sem iniciar uma partida."}
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
        title={isUpcoming ? SORT_ASSUME_UPCOMING_STAY : "Voltar"}
        preset="outline"
        isDisabled={isAssuming}
        onPress={cancel}
      />
    </BottomSheet>
  );
};
