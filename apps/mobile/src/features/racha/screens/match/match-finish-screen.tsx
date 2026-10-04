import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomSheet, Button, OptionList, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MATCH_WINNER_PICK, SORT_BACK } from "../../utils/racha-messages";
import { useMatchFinishScreen } from "./use-match-finish-screen";

export const MatchFinishScreen = () => {
  const {
    isMissing,
    title,
    vsLine,
    scoreLine,
    consequence,
    isLoadingPreview,
    needsWinner,
    winnerId,
    winnerOptions,
    pickWinner,
    confirmLabel,
    busyLabel,
    isBusy,
    failureMessage,
    confirm,
    cancel,
  } = useMatchFinishScreen();

  if (isMissing) return null;

  return (
    <BottomSheet title={title} hasCloseButton={false} isBusy={isBusy}>
      <View style={styles.result}>
        <Text preset="body" style={styles.center}>
          {vsLine}
        </Text>
        <Text preset="h1" style={styles.center}>
          {scoreLine}
        </Text>
      </View>
      {needsWinner ? (
        <>
          <Text>{MATCH_WINNER_PICK}</Text>
          <OptionList
            options={winnerOptions}
            value={winnerId ?? ""}
            onChange={pickWinner}
            isDisabled={isBusy}
          />
        </>
      ) : null}
      {isLoadingPreview ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : consequence ? (
        <Text color="muted">{consequence}</Text>
      ) : null}
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button
        title={confirmLabel}
        onPress={confirm}
        isLoading={isBusy}
        isDisabled={isLoadingPreview || (needsWinner && !winnerId)}
        accessibilityLabel={isBusy ? busyLabel : confirmLabel}
      />
      <Button
        title={SORT_BACK}
        preset="outline"
        onPress={cancel}
        isDisabled={isBusy}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  result: { alignItems: "center", gap: theme.space[4] },
  center: { textAlign: "center" },
});
