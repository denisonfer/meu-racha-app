import { StyleSheet, View } from "react-native";
import { PlayerCardMini, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  SEASON_LEFT,
  SEASON_ME,
  seasonPosition,
} from "../../utils/racha-messages";

export type TRankingRow = {
  key: string;
  position: number;
  name: string;
  initials: string;
  photoUrl: string | null;
  overall: number;
  value: number;
  unit: string;
  isMe: boolean;
  hasLeft: boolean;
  accessibilityLabel: string;
};

type TRankingRowProps = TRankingRow & {
  variant: "list" | "pinned";
};

export const RankingRow = ({
  position,
  name,
  initials,
  photoUrl,
  overall,
  value,
  unit,
  isMe,
  hasLeft,
  accessibilityLabel,
  variant,
}: TRankingRowProps) => {
  const isPodium = position <= 3;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        variant === "list" && isMe && styles.meList,
        variant === "pinned" && styles.pinned,
      ]}
    >
      {variant === "list" && isMe ? <View style={styles.meEdge} /> : null}
      <Text
        style={[
          styles.position,
          { color: isPodium ? theme.colors.action : theme.colors.muted },
        ]}
      >
        {seasonPosition(position)}
      </Text>
      <View style={hasLeft ? styles.cardDim : undefined}>
        <PlayerCardMini
          width={36}
          overall={overall}
          initials={initials}
          photoUri={photoUrl}
          showOverall={false}
        />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            color={hasLeft ? "muted" : "foreground"}
            style={styles.name}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isMe ? (
            <View style={styles.mePill}>
              <Text color="onAction" style={styles.mePillLabel}>
                {SEASON_ME}
              </Text>
            </View>
          ) : null}
        </View>
        {hasLeft ? (
          <Text preset="caption" color="muted" style={styles.leftLabel}>
            {SEASON_LEFT}
          </Text>
        ) : null}
      </View>
      <View style={styles.stat}>
        <Text style={styles.value}>{value}</Text>
        <Text preset="caption" color="muted" style={styles.unit}>
          {unit}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: 12,
    gap: 10,
    overflow: "hidden",
  },
  meList: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  meEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.action,
  },
  pinned: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.action,
    borderRadius: theme.radius.card,
  },
  position: {
    ...theme.text.stat,
    width: 34,
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  cardDim: { opacity: 0.5 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  mePill: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action,
  },
  mePillLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 11,
    lineHeight: 14,
  },
  leftLabel: { fontFamily: "Manrope-Bold" },
  stat: { alignItems: "flex-end", flexShrink: 0 },
  value: {
    ...theme.text.stat,
    fontSize: 24,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  unit: { fontFamily: "Manrope-Bold" },
});
