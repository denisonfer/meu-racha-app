import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme, type TThemeColor } from "@/ui/theme";
import {
  MATCH_NEXT_MATCH,
  MATCH_ON_FIELD,
  MATCH_QUEUE_NEXT,
  SORT_INCOMPLETE,
} from "../utils/racha-messages";

export type TTeamQueueBadge = "next" | "nextMatch" | "onField";

export type TTeamQueueOptionProps = {
  position: number;
  teamNumber: number;
  count: number;
  capacity: number;
  badges: TTeamQueueBadge[];
  sub: string | null;
  subTone: "muted" | "action" | "warning";
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
};

const BADGE_LABEL: Record<TTeamQueueBadge, string> = {
  next: MATCH_QUEUE_NEXT,
  nextMatch: MATCH_NEXT_MATCH,
  onField: MATCH_ON_FIELD,
};

const SUB_COLOR: Record<TTeamQueueOptionProps["subTone"], TThemeColor> = {
  muted: "muted",
  action: "action",
  warning: "warning",
};

/** Linha de Time no formato da fila, com escolha única. */
export const TeamQueueOption = ({
  position,
  teamNumber,
  count,
  capacity,
  badges,
  sub,
  subTone,
  isSelected,
  isDisabled,
  onPress,
}: TTeamQueueOptionProps) => {
  const isIncomplete = count < capacity;
  const label = [
    `${position}º`,
    `Time ${teamNumber}`,
    `${count} de ${capacity}`,
    isIncomplete ? "incompleto" : null,
    ...badges.map((badge) => BADGE_LABEL[badge].toLowerCase()),
    sub,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      style={[
        styles.row,
        isSelected
          ? styles.rowSelected
          : isDisabled
            ? styles.rowDisabled
            : styles.rowIdle,
      ]}
    >
      <View
        style={[
          styles.ring,
          {
            borderColor: isSelected
              ? theme.colors.action
              : isDisabled
                ? theme.colors.mutedDisabled
                : theme.colors.muted,
          },
        ]}
      >
        {isSelected ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              isDisabled && { color: theme.colors.textDisabled },
            ]}
          >
            {`${position}º · Time ${teamNumber}`}
          </Text>
          {badges.map((badge) => (
            <View
              key={badge}
              style={[
                styles.badge,
                badge === "next" && styles.badgeNext,
                badge === "nextMatch" && styles.badgeNextMatch,
                badge === "onField" && styles.badgeOnField,
              ]}
            >
              <Text
                style={styles.badgeLabel}
                color={
                  badge === "next" || badge === "onField"
                    ? "action"
                    : "foreground"
                }
              >
                {BADGE_LABEL[badge]}
              </Text>
            </View>
          ))}
        </View>
        {sub ? (
          <Text
            preset="caption"
            color={isDisabled ? "muted" : SUB_COLOR[subTone]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.count}>
        <Text
          style={[
            styles.countNumber,
            {
              color: isDisabled
                ? theme.colors.textDisabled
                : isIncomplete
                  ? theme.colors.warning
                  : theme.colors.foreground,
            },
          ]}
        >
          {`${count}/${capacity}`}
        </Text>
        {isIncomplete && !isDisabled ? (
          <Text style={styles.incomplete} color="warning">
            {SORT_INCOMPLETE}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  rowIdle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  rowSelected: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 2,
    borderColor: theme.colors.action,
  },
  rowDisabled: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.action,
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  title: { fontFamily: "Manrope-Bold", fontSize: 16, lineHeight: 22 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  badgeNext: { backgroundColor: theme.colors.actionDisabled },
  badgeNextMatch: { borderWidth: 1, borderColor: theme.colors.muted },
  badgeOnField: { borderWidth: 1, borderColor: theme.colors.action },
  badgeLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  count: { alignItems: "flex-end" },
  countNumber: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 22,
    lineHeight: 24,
  },
  incomplete: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
});
