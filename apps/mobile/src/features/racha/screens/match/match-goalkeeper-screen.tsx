import { Pressable, ScrollView, StyleSheet } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useMatchGoalkeeperScreen } from "./use-match-goalkeeper-screen";

export const MatchGoalkeeperScreen = () => {
  const {
    isMissing,
    title,
    teamLabel,
    isBusy,
    failureMessage,
    people,
    cancel,
  } = useMatchGoalkeeperScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={<Text color="muted">{teamLabel}</Text>}
      isBusy={isBusy}
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {people.map((person) => (
          <Pressable
            key={person.personId}
            onPress={person.onPress}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`${person.name}, ${person.detail}`}
            style={[styles.row, person.isFirst && styles.first]}
          >
            <Text
              preset="body"
              color={person.isFirst ? "action" : "foreground"}
            >
              {person.name}
            </Text>
            <Text preset="caption" color={person.isFirst ? "action" : "muted"}>
              {person.detail}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button
        title="Cancelar"
        preset="outline"
        isDisabled={isBusy}
        onPress={cancel}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  list: { maxHeight: 320 },
  listContent: { gap: theme.space[8] },
  row: {
    minHeight: theme.minTouch,
    padding: theme.space[8],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    gap: 2,
  },
  first: {
    borderWidth: 1,
    borderColor: theme.colors.action,
    backgroundColor: theme.colors.surfaceRaised,
  },
});
