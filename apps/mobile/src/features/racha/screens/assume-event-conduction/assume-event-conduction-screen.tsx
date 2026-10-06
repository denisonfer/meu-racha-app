import { BottomSheet, Button, Text } from "@/ui/components";
import {
  ASSUME_ACTIVE_BACK,
  ASSUME_ACTIVE_TITLE,
  assumeActiveText,
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
      title={isUpcoming ? SORT_ASSUME_UPCOMING_TITLE : ASSUME_ACTIVE_TITLE}
      supporting={
        <Text>
          {isUpcoming
            ? sortAssumeUpcomingText(conductorName ?? "Outra pessoa")
            : assumeActiveText(conductorName)}
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
        title={isUpcoming ? SORT_ASSUME_UPCOMING_STAY : ASSUME_ACTIVE_BACK}
        preset="outline"
        isDisabled={isAssuming}
        onPress={cancel}
      />
    </BottomSheet>
  );
};
