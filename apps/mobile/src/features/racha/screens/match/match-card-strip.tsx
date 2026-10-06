import { StyleSheet, View } from "react-native";
import { Icon, PenaltyCard, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export type TMatchCardPill = {
  key: string;
  name: string;
  team: string;
  kind: "yellow" | "back";
  remaining: string | null;
  isPaused: boolean;
  label: string;
};

type TMatchCardStripProps = {
  pills: TMatchCardPill[];
};

const VISIBLE = 3;

/** Amarelos correndo, um embaixo do outro. Sem pílula, não ocupa altura. */
export const MatchCardStrip = ({ pills }: TMatchCardStripProps) => {
  if (pills.length === 0) return null;
  const shown = pills.slice(0, VISIBLE);
  const extra = pills.length - shown.length;

  return (
    <View style={styles.list}>
      {shown.map((pill) => (
        <View
          key={pill.key}
          accessibilityRole="timer"
          accessibilityLabel={pill.label}
          style={[styles.pill, pill.kind === "back" && styles.back]}
        >
          {pill.kind === "yellow" ? (
            <PenaltyCard color="yellow" size="sm" />
          ) : (
            <Icon name="check" size={16} color="action" />
          )}
          <Text numberOfLines={1} style={styles.name}>
            {pill.name}
          </Text>
          <Text numberOfLines={1} color="muted" style={styles.team}>
            {pill.team}
          </Text>
          {pill.kind === "yellow" && pill.remaining ? (
            <View style={styles.timer}>
              {pill.isPaused ? (
                <Icon name="clock" size={14} color="muted" />
              ) : null}
              <Text
                style={[styles.timerText, pill.isPaused && styles.timerPaused]}
              >
                {pill.remaining}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
      {extra > 0 ? (
        <Text preset="caption" color="muted">
          +{extra}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { gap: 6 },
  pill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceRaised,
  },
  back: { borderWidth: 1, borderColor: theme.colors.action },
  name: {
    flexShrink: 1,
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    lineHeight: 18,
  },
  team: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  timer: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 20,
    lineHeight: 22,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  timerPaused: { color: theme.colors.muted },
});
