import { StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  NoticeBanner,
  OptionList,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { useMatchLeaveScreen } from "./use-match-leave-screen";

export const MatchLeaveScreen = () => {
  const {
    isMissing,
    title,
    supporting,
    hasDonors,
    noDonorText,
    options,
    choice,
    onChoice,
    primaryLabel,
    busyLabel,
    isBusy,
    failureMessage,
    confirm,
    cancel,
  } = useMatchLeaveScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={<Text color="muted">{supporting}</Text>}
      hasCloseButton={false}
      isBusy={isBusy}
    >
      <View style={styles.body}>
        {hasDonors ? (
          <OptionList
            options={options}
            value={choice}
            onChange={onChoice}
            isDisabled={isBusy}
          />
        ) : (
          <NoticeBanner tone="warning" text={noDonorText} />
        )}
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title={isBusy ? busyLabel : primaryLabel}
          onPress={confirm}
          isDisabled={isBusy}
          isLoading={isBusy}
        />
        <Button
          title="Cancelar"
          preset="outline"
          isDisabled={isBusy}
          onPress={cancel}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: theme.space[16] },
});
