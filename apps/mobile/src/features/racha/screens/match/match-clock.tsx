import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_OVERTIME,
  MATCH_PAUSE,
  MATCH_PAUSED,
  MATCH_RESUME,
  matchDurationLine,
} from "../../utils/racha-messages";

type TMatchClockProps = {
  mainLabel: string;
  overtimeLabel: string | null;
  durationLabel: string | null;
  accessibilityLabel: string;
  isPaused: boolean;
  isOvertime: boolean;
  showPause: boolean;
  isPauseDisabled: boolean;
  isPauseBusy: boolean;
  onTogglePause: () => void;
};

export const MatchClock = ({
  mainLabel,
  overtimeLabel,
  durationLabel,
  accessibilityLabel,
  isPaused,
  isOvertime,
  showPause,
  isPauseDisabled,
  isPauseBusy,
  onTogglePause,
}: TMatchClockProps) => (
  <View
    style={styles.clockBlock}
    accessible
    accessibilityRole="timer"
    accessibilityLabel={accessibilityLabel}
  >
    <View
      style={styles.clockRow}
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[styles.mainClock, isOvertime && styles.mainClockAtLimit]}
        importantForAccessibility="no"
      >
        {mainLabel}
      </Text>
      {overtimeLabel ? (
        <View style={styles.overtimeWrap}>
          <Text preset="caption" color="warning">
            {MATCH_OVERTIME}
          </Text>
          <Text style={styles.overtimeClock}>{overtimeLabel}</Text>
        </View>
      ) : null}
    </View>
    {showPause ? (
      <Button
        title={isPaused ? MATCH_RESUME : MATCH_PAUSE}
        preset="outline"
        onPress={onTogglePause}
        isDisabled={isPauseDisabled}
        isLoading={isPauseBusy}
        style={styles.pauseBtn}
      />
    ) : isPaused ? (
      <Text preset="caption" color="muted">
        {MATCH_PAUSED}
      </Text>
    ) : null}
    {durationLabel && !isOvertime ? (
      <Text preset="caption" color="muted">
        {matchDurationLine(durationLabel)}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  clockBlock: {
    alignItems: "center",
    gap: theme.space[8],
    marginBottom: theme.space[24],
    paddingVertical: theme.space[16],
    paddingHorizontal: theme.space[8],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  clockRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: theme.space[16],
  },
  mainClock: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 80,
    lineHeight: 80,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  mainClockAtLimit: {
    color: theme.colors.muted,
  },
  overtimeWrap: {
    alignItems: "flex-start",
    paddingBottom: 10,
    gap: 2,
  },
  overtimeClock: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 36,
    lineHeight: 36,
    color: theme.colors.warning,
    fontVariant: ["tabular-nums"],
  },
  pauseBtn: { minWidth: 140 },
});
