import { Pressable, ScrollView, StyleSheet } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SORT_BACK } from "../../utils/racha-messages";
import { useMatchGoalScreen } from "./use-match-goal-screen";

export const MatchGoalScreen = () => {
  const {
    isMissing,
    isBusy,
    step,
    title,
    hint,
    ownGoalLabel,
    noAssistLabel,
    people,
    failureMessage,
    pickOwnGoal,
    pickScorer,
    pickAssist,
    backToScorer,
    cancel,
  } = useMatchGoalScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={hint ? <Text color="muted">{hint}</Text> : undefined}
      isBusy={isBusy}
    >
      {ownGoalLabel ? (
        <Pressable
          onPress={pickOwnGoal}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={ownGoalLabel}
          style={styles.ownGoal}
        >
          <Text preset="body" color="warning">
            {ownGoalLabel}
          </Text>
        </Pressable>
      ) : null}
      {noAssistLabel ? (
        <Pressable
          onPress={() => pickAssist(null)}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={noAssistLabel}
          style={styles.noAssist}
        >
          <Text preset="body" color="action">
            {noAssistLabel}
          </Text>
        </Pressable>
      ) : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {people.map((person) => (
          <Pressable
            key={person.personId}
            onPress={() =>
              step === "assist" ? pickAssist(person) : pickScorer(person)
            }
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={person.displayName}
            style={styles.row}
          >
            <Text preset="body">{person.displayName}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      {step === "assist" ? (
        <Button
          title={SORT_BACK}
          preset="outline"
          isDisabled={isBusy}
          onPress={backToScorer}
        />
      ) : (
        <Button
          title="Cancelar"
          preset="outline"
          isDisabled={isBusy}
          onPress={cancel}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  ownGoal: {
    minHeight: theme.minTouch,
    padding: theme.space[8],
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningSurface,
    justifyContent: "center",
  },
  noAssist: {
    minHeight: theme.minTouch,
    padding: theme.space[8],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.actionDisabled,
    justifyContent: "center",
  },
  list: { maxHeight: 280 },
  listContent: { gap: 4 },
  row: {
    minHeight: theme.minTouch,
    paddingVertical: theme.space[8],
    paddingHorizontal: theme.space[8],
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
});
