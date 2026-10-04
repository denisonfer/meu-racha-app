import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MATCH_TAP_GOAL } from "../../utils/racha-messages";

type TMatchScoreHalf = {
  teamLabel: string;
  score: number;
  accessibilityLabel: string;
  onPress: (() => void) | null;
};

type TMatchScoreboardProps = {
  home: TMatchScoreHalf;
  away: TMatchScoreHalf;
};

const ScoreHalf = ({
  teamLabel,
  score,
  accessibilityLabel,
  onPress,
  raised,
}: TMatchScoreHalf & { raised: boolean }) => (
  <Pressable
    style={[styles.half, raised ? styles.homeHalf : styles.awayHalf]}
    onPress={onPress ?? undefined}
    disabled={onPress === null}
    accessibilityRole={onPress ? "button" : undefined}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={onPress ? MATCH_TAP_GOAL : undefined}
  >
    <Text preset="body" color="muted">
      {teamLabel}
    </Text>
    <Text style={styles.score}>{score}</Text>
    {onPress ? (
      <Text preset="caption" color="muted">
        {MATCH_TAP_GOAL}
      </Text>
    ) : null}
  </Pressable>
);

export const MatchScoreboard = ({ home, away }: TMatchScoreboardProps) => (
  <View style={styles.scoreboard}>
    <ScoreHalf {...home} raised />
    <Text style={styles.divider}>×</Text>
    <ScoreHalf {...away} raised={false} />
  </View>
);

const styles = StyleSheet.create({
  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space[16],
    minHeight: 120,
  },
  half: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.card,
    paddingVertical: theme.space[16],
    minHeight: 120,
    gap: 4,
  },
  homeHalf: { backgroundColor: theme.colors.surfaceRaised },
  awayHalf: { backgroundColor: theme.colors.surface },
  score: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 48,
    lineHeight: 48,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    fontFamily: "Manrope-Bold",
    fontSize: 22,
    color: theme.colors.muted,
    marginHorizontal: 8,
  },
});
