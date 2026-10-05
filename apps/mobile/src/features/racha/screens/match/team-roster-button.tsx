import { Pressable, StyleSheet } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_ROSTER,
  matchOccupancy,
  matchRosterLabel,
} from "../../utils/racha-messages";

type TTeamRosterButtonProps = {
  teamNumber: number;
  count: number;
  capacity: number;
  onPress: () => void;
};

export const TeamRosterButton = ({
  teamNumber,
  count,
  capacity,
  onPress,
}: TTeamRosterButtonProps) => {
  const isIncomplete = count < capacity;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={matchRosterLabel(teamNumber, count, capacity)}
      style={[
        styles.button,
        isIncomplete ? styles.incomplete : styles.complete,
      ]}
    >
      <Icon
        name={isIncomplete ? "alert" : "users"}
        size={20}
        color={isIncomplete ? "warning" : "muted"}
      />
      {isIncomplete ? null : (
        <Text preset="small" style={styles.word}>
          {MATCH_ROSTER}
        </Text>
      )}
      <Text
        color={isIncomplete ? "warning" : "foreground"}
        style={styles.count}
      >
        {matchOccupancy(count, capacity)}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: theme.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[8],
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.space[8],
  },
  complete: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.muted,
  },
  incomplete: {
    backgroundColor: theme.colors.warningSurface,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.colors.warning,
  },
  word: { fontFamily: "Manrope-Bold" },
  count: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 20,
    lineHeight: 24,
  },
});
