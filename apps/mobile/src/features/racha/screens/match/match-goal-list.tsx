import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_DELETE_GOAL,
  MATCH_GOALS_TITLE,
} from "../../utils/racha-messages";

export type TMatchGoalRow = {
  id: string;
  text: string;
  onDelete: (() => void) | null;
};

type TMatchGoalListProps = {
  goals: TMatchGoalRow[];
};

export const MatchGoalList = ({ goals }: TMatchGoalListProps) => (
  <View style={styles.list}>
    <Text preset="h3" accessibilityRole="header">
      {MATCH_GOALS_TITLE}
    </Text>
    {goals.map((goal) => (
      <View key={goal.id} style={styles.goalRow}>
        <Text preset="body" style={styles.goalText}>
          {goal.text}
        </Text>
        {goal.onDelete ? (
          <Pressable
            onPress={goal.onDelete}
            accessibilityRole="button"
            accessibilityLabel={`${MATCH_DELETE_GOAL} ${goal.text}`}
            style={styles.delete}
          >
            <Text preset="caption" color="danger">
              {MATCH_DELETE_GOAL}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  list: { gap: theme.space[8], paddingBottom: theme.space[16] },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: theme.minTouch,
    paddingVertical: theme.space[8],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
    gap: theme.space[8],
  },
  goalText: { flex: 1 },
  delete: {
    minHeight: theme.minTouch,
    minWidth: theme.minTouch,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: theme.space[8],
  },
});
