import { StyleSheet, View } from "react-native";
import {
  Icon,
  LogoSymbol,
  PenaltyCard,
  PlayerCard,
  Text,
  type TPlayerCardProps,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  RESENHA_POSTER_FOOTER,
  RESENHA_POSTER_NO_GOALS,
  RESENHA_POSTER_NOBODY,
  RESENHA_POSTER_TOP_SCORER,
  RESENHA_TOP_ASSIST,
  RESENHA_TOP_TEAM,
  RESENHA_NO_ASSISTS,
  RESENHA_NO_TEAM,
  RESENHA_ONLY_DRAWS,
} from "../../utils/racha-messages";

export type TResenhaPosterLeader = {
  names: string;
  count: number;
};

export type TResenhaPosterCardItem = {
  color: "yellow" | "red";
  text: string;
};

export type TResenhaPosterProps = {
  rachaName: string;
  posterDate: string;
  shortDate: string;
  infoLine: string;
  scorers: {
    names: string;
    count: number;
    unit: string;
    nameCount: number;
  } | null;
  scorerCard: Omit<TPlayerCardProps, "width"> | null;
  topTeam: { names: string; winsLine: string; ofMatches: string } | null;
  assists: TResenhaPosterLeader | null;
  cards: TResenhaPosterCardItem[];
  cardsSummary: string | null;
};

function scorerNameSize(nameCount: number): number {
  if (nameCount >= 3) return 44;
  if (nameCount === 2) return 58;
  return 86;
}

// com a carta, ela já diz quem é: o número de gols vira a manchete
const CARD_GOALS_SIZE = 72;

export const ResenhaPoster = ({
  rachaName: _rachaName,
  posterDate,
  shortDate,
  infoLine,
  scorers,
  scorerCard,
  topTeam,
  assists,
  cards,
  cardsSummary,
}: TResenhaPosterProps) => {
  const hasCard = scorerCard !== null;
  const nameSize = scorers ? scorerNameSize(scorers.nameCount) : 52;
  const heroNames = scorers
    ? scorers.names.toUpperCase()
    : RESENHA_POSTER_NOBODY;
  const heroValue = scorers
    ? `${scorers.count} ${scorers.unit.toUpperCase()}`
    : "";

  return (
    <View style={styles.poster}>
      <View style={styles.cover}>
        <View style={styles.coverTop}>
          <View style={styles.brand}>
            <LogoSymbol height={22} color="onAction" accentColor="onAction" />
            <Text style={styles.wordmark}>MEU RACHA</Text>
          </View>
          <Text style={styles.coverDate}>{`RESENHA · ${posterDate}`}</Text>
        </View>
        <View style={styles.coverBottom}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>
              {scorers ? RESENHA_POSTER_TOP_SCORER : RESENHA_POSTER_NO_GOALS}
            </Text>
            {hasCard ? null : (
              <Text
                style={[
                  styles.heroNames,
                  { fontSize: nameSize, lineHeight: nameSize * 0.92 },
                ]}
              >
                {heroNames}
              </Text>
            )}
            {heroValue ? (
              <Text
                style={[
                  styles.heroValue,
                  hasCard && {
                    fontSize: CARD_GOALS_SIZE,
                    lineHeight: CARD_GOALS_SIZE * 0.92,
                  },
                ]}
              >
                {heroValue}
              </Text>
            ) : null}
          </View>
          {scorerCard ? (
            <View style={styles.cardWrap}>
              <PlayerCard width={150} {...scorerCard} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.info}>{infoLine}</Text>
        <View style={styles.duo}>
          <View style={styles.duoBlock}>
            <Text style={styles.duoLabel}>{RESENHA_TOP_ASSIST}</Text>
            <Text style={styles.duoText}>
              {assists
                ? `${assists.names} · ${assists.count}`
                : RESENHA_NO_ASSISTS}
            </Text>
          </View>
        </View>
        <View style={styles.team}>
          <Icon name="trophy" size={34} color="action" />
          <View style={styles.teamCopy}>
            <Text style={styles.teamLabel}>{RESENHA_TOP_TEAM}</Text>
            <Text
              style={[
                styles.teamNames,
                {
                  color: topTeam ? theme.colors.foreground : theme.colors.muted,
                },
              ]}
            >
              {topTeam ? topTeam.names : RESENHA_NO_TEAM}
            </Text>
          </View>
          <View style={styles.teamStat}>
            {topTeam ? (
              <Text style={styles.teamWins}>{topTeam.winsLine}</Text>
            ) : null}
            <Text style={styles.teamOf}>
              {topTeam ? topTeam.ofMatches : RESENHA_ONLY_DRAWS}
            </Text>
          </View>
        </View>
        {cardsSummary ? (
          <Text style={styles.cardLine}>{cardsSummary}</Text>
        ) : cards.length > 0 ? (
          <View style={styles.cardRow}>
            {cards.map((card) => (
              <View key={card.text} style={styles.cardItem}>
                <PenaltyCard color={card.color} size="xs" />
                <Text style={styles.cardText}>{card.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text style={styles.footer}>
        {`${RESENHA_POSTER_FOOTER} · ${shortDate}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  poster: {
    width: 432,
    height: 540,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  cover: {
    height: 300,
    backgroundColor: theme.colors.action,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    justifyContent: "space-between",
  },
  coverTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 1.5,
    color: theme.colors.onAction,
  },
  coverDate: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    color: theme.colors.onAction,
  },
  coverBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: theme.colors.onAction,
  },
  heroNames: {
    fontFamily: "BarlowCondensed-Bold",
    letterSpacing: -0.5,
    textTransform: "uppercase",
    color: theme.colors.onAction,
  },
  heroValue: {
    marginTop: 6,
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 34,
    lineHeight: 34,
    color: theme.colors.onAction,
  },
  cardWrap: {
    flexShrink: 0,
    shadowColor: "#07180F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  body: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 22,
    gap: 12,
  },
  info: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.muted,
  },
  duo: { flexDirection: "row", gap: 18 },
  duoBlock: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.action,
    paddingLeft: 10,
    gap: 2,
  },
  duoLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    color: theme.colors.muted,
  },
  duoText: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 15,
    lineHeight: 19,
    color: theme.colors.foreground,
  },
  team: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  teamCopy: { flex: 1, minWidth: 0 },
  teamLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    color: theme.colors.muted,
  },
  teamNames: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 36,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  teamStat: { flexShrink: 0, alignItems: "flex-end" },
  teamWins: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    lineHeight: 17,
    color: theme.colors.foreground,
  },
  teamOf: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    lineHeight: 17,
    color: theme.colors.muted,
  },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginRight: 8,
  },
  cardText: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.foreground,
  },
  cardLine: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.foreground,
  },
  footer: {
    height: 26,
    paddingHorizontal: 22,
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    lineHeight: 26,
    color: theme.colors.muted,
  },
});
