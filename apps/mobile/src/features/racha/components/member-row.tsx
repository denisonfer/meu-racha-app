import { StyleSheet, View } from "react-native";
import { Icon, PlayerCardMini, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TMemberRole } from "../racha-types";
import { RoleChip } from "./role-chip";

type TMemberRowProps = {
  name: string;
  initials: string;
  photoUrl: string | null;
  overall: number;
  isMe: boolean;
  role: TMemberRole;
  isGoalkeeper: boolean;
  positionText: string;
  stars: number | null;
  isSuperStar: boolean;
  accessibilityLabel: string;
};

export const MemberRow = ({
  name,
  initials,
  photoUrl,
  overall,
  isMe,
  role,
  isGoalkeeper,
  positionText,
  stars,
  isSuperStar,
  accessibilityLabel,
}: TMemberRowProps) => (
  <View accessible accessibilityLabel={accessibilityLabel} style={[styles.row]}>
    <PlayerCardMini
      width={44}
      overall={overall}
      initials={initials}
      photoUri={photoUrl}
    />

    <View style={styles.info}>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {isMe ? <Text style={styles.you}> · Você</Text> : null}
      </View>
      <View style={styles.metaRow}>
        {role !== "PLAYER" ? <RoleChip role={role} /> : null}
        <Text preset="small" color="muted" style={styles.position}>
          {positionText}
        </Text>
      </View>
    </View>

    <View style={styles.right}>
      {isGoalkeeper ? (
        <Text style={styles.gol}>GOL</Text>
      ) : (
        <View style={styles.starsRow}>
          <Text style={styles.starsNumber}>{stars}</Text>
          <Icon name="star" size={18} color="action" fill="action" />
        </View>
      )}
      {isSuperStar ? (
        <View style={styles.superChip}>
          <Text style={styles.superChipLabel}>SUPER ESTRELA</Text>
        </View>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingVertical: 5,
  },

  info: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "baseline", minWidth: 0 },
  name: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  you: { flexShrink: 0, fontFamily: "Manrope-Bold", fontSize: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  position: { fontFamily: "Manrope-Bold" },
  right: { alignItems: "flex-end", gap: 4, minWidth: 64 },
  gol: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 1,
  },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  starsNumber: {
    ...theme.text.stat,
    fontSize: 24,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  superChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: theme.radius.check,
    borderWidth: 1,
    borderColor: theme.colors.action,
  },
  superChipLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
