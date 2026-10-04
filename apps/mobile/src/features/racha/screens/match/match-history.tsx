import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MatchGoalText } from "./match-goal-text";
import {
  MATCH_CORRECT,
  MATCH_FINISHED_TITLE,
  matchNumberLabel,
  matchScoreLine,
  matchVsLine,
} from "../../utils/racha-messages";

export type TMatchHistoryGoal = {
  id: string;
  scorer: string;
  assist: string | null;
  label: string;
  onCorrect: (() => void) | null;
};

export type TMatchHistoryItem = {
  id: string;
  number: number;
  homeNumber: number;
  awayNumber: number;
  homeScore: number;
  awayScore: number;
  goals: TMatchHistoryGoal[];
};

type TMatchHistoryProps = {
  matches: TMatchHistoryItem[];
};

export const MatchHistory = ({ matches }: TMatchHistoryProps) => {
  if (matches.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text preset="h3" accessibilityRole="header">
        {MATCH_FINISHED_TITLE}
      </Text>
      {matches.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text preset="caption" color="muted">
            {matchNumberLabel(item.number)}
          </Text>
          <Text preset="body">
            {matchVsLine(item.homeNumber, item.awayNumber)}
          </Text>
          <Text preset="stat">
            {matchScoreLine(item.homeScore, item.awayScore)}
          </Text>
          {item.goals.map((goal) => (
            <View key={goal.id} style={styles.goalRow}>
              <MatchGoalText
                scorer={goal.scorer}
                assist={goal.assist}
                label={goal.label}
                preset="small"
              />
              {goal.onCorrect ? (
                <Pressable
                  onPress={goal.onCorrect}
                  accessibilityRole="button"
                  accessibilityLabel={`${MATCH_CORRECT} ${goal.label}`}
                  style={styles.correct}
                >
                  <Text preset="caption" color="action">
                    {MATCH_CORRECT}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: theme.space[8], paddingBottom: theme.space[16] },
  card: {
    gap: theme.space[8],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: theme.minTouch,
    gap: theme.space[8],
  },
  correct: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.space[8],
  },
});
