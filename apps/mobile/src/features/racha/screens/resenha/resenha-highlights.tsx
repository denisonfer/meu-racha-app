import { StyleSheet, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  RESENHA_NO_ASSISTS,
  RESENHA_NO_GOALS,
  RESENHA_NO_TEAM,
  RESENHA_ONLY_DRAWS,
  RESENHA_TOP_ASSIST,
  RESENHA_TOP_SCORER,
  RESENHA_TOP_TEAM,
} from "../../utils/racha-messages";

export type TResenhaLeader = {
  names: string;
  count: number;
  unit: string;
  nameCount?: number;
};

export type TResenhaTopTeamView = {
  names: string;
  wins: number;
  unit: string;
  ofMatches: string;
};

export type TResenhaHighlightsProps = {
  scorers: TResenhaLeader | null;
  topTeam: TResenhaTopTeamView | null;
  assists: TResenhaLeader | null;
};

export const ResenhaHighlights = ({
  scorers,
  topTeam,
  assists,
}: TResenhaHighlightsProps) => {
  const scorerSize = scorers?.nameCount ?? 1;
  const scorerFont = scorerSize >= 3 ? 20 : scorerSize === 2 ? 24 : 28;

  return (
    <View style={styles.wrap} accessibilityLabel="Destaques">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text preset="caption" color="action" style={styles.label}>
            {RESENHA_TOP_SCORER}
          </Text>
          <Text
            style={[
              styles.heroName,
              {
                fontSize: scorerFont,
                color: scorers ? theme.colors.foreground : theme.colors.muted,
              },
            ]}
          >
            {scorers ? scorers.names : RESENHA_NO_GOALS}
          </Text>
        </View>
        {scorers ? (
          <View style={styles.heroStat}>
            <Text color="action" style={styles.heroNumber}>
              {scorers.count}
            </Text>
            <Text preset="caption" color="muted" style={styles.unitBold}>
              {scorers.unit}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={styles.team}
        accessibilityLabel={
          topTeam
            ? `Time mais vitorioso: ${topTeam.names}, ${topTeam.wins} ${topTeam.unit} ${topTeam.ofMatches}`
            : `${RESENHA_NO_TEAM}, ${RESENHA_ONLY_DRAWS}`
        }
      >
        <Icon name="trophy" size={28} color="action" />
        <View style={styles.teamCopy}>
          <Text preset="caption" color="muted" style={styles.label}>
            {RESENHA_TOP_TEAM}
          </Text>
          <Text
            preset="h2"
            style={[
              styles.extraBold,
              { color: topTeam ? theme.colors.foreground : theme.colors.muted },
            ]}
          >
            {topTeam ? topTeam.names : RESENHA_NO_TEAM}
          </Text>
        </View>
        <View style={styles.teamStat}>
          {topTeam ? (
            <View style={styles.teamWins}>
              <Text style={styles.teamNumber}>{topTeam.wins}</Text>
              <Text preset="caption" color="muted" style={styles.unitBold}>
                {topTeam.unit}
              </Text>
            </View>
          ) : null}
          <Text preset="caption" color="muted">
            {topTeam ? topTeam.ofMatches : RESENHA_ONLY_DRAWS}
          </Text>
        </View>
      </View>

      <View style={styles.duo}>
        <DuoCard
          label={RESENHA_TOP_ASSIST}
          leader={assists}
          empty={RESENHA_NO_ASSISTS}
        />
      </View>
    </View>
  );
};

const DuoCard = ({
  label,
  leader,
  empty,
}: {
  label: string;
  leader: TResenhaLeader | null;
  empty: string | null;
}) => (
  <View style={styles.duoCard}>
    <Text preset="caption" color="muted" style={styles.label}>
      {label}
    </Text>
    <Text
      style={[
        styles.duoName,
        { color: leader ? theme.colors.foreground : theme.colors.muted },
      ]}
    >
      {leader ? leader.names : empty}
    </Text>
    {leader ? (
      <View style={styles.duoStat}>
        <Text style={styles.duoNumber}>{leader.count}</Text>
        <Text preset="caption" color="muted" style={styles.unitBold}>
          {leader.unit}
        </Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroName: { fontFamily: "Manrope-ExtraBold", lineHeight: 34 },
  heroStat: { alignItems: "center", flexShrink: 0 },
  heroNumber: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 56,
    lineHeight: 52,
  },
  team: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
  },
  teamCopy: { flex: 1, minWidth: 0, gap: 2 },
  teamStat: { alignItems: "flex-end", flexShrink: 0 },
  teamWins: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  teamNumber: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 34,
    lineHeight: 34,
    color: theme.colors.foreground,
  },
  duo: { flexDirection: "row", gap: 8 },
  duoCard: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  duoName: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 16,
    lineHeight: 22,
  },
  duoStat: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  duoNumber: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 30,
    lineHeight: 30,
    color: theme.colors.foreground,
  },
  label: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.8 },
  extraBold: { fontFamily: "Manrope-ExtraBold" },
  unitBold: { fontFamily: "Manrope-Bold" },
});
