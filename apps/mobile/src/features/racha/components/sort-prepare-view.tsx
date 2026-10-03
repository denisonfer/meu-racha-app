import { StyleSheet, View } from "react-native";
import { Button, NoticeBanner, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  SORT_BALANCE_STARS,
  SORT_BALANCE_STARS_POSITION,
  SORT_PREPARE,
  SORT_PREPARE_HERO_TEXT,
  SORT_PREPARE_HERO_TITLE,
  SORT_PREPARE_HINT,
  SORT_PREPARE_RULES_TITLE,
  SORT_RULE_BALANCE,
  SORT_RULE_OUTFIELD,
  SORT_RUN,
  SORT_VIEW_ATTENDANCE,
  sortGoalkeeperCountLabel,
  sortLineCountLabel,
  sortOutfieldPerTeam,
} from "../utils/racha-messages";
import { SortFailure } from "./sort-failure";
import { SortPage } from "./sort-page";

type TSortPrepareViewProps = {
  kicker: string;
  when: string;
  place: string;
  lineCount: number;
  goalkeeperCount: number;
  // “N confirmaram · M vieram”
  attendanceSummary: string;
  // confirmados sem “veio” ficam fora; lembra de marcar na Presença
  markAttendedText: string | null;
  outfieldPerTeam: number | null;
  considerPosition: boolean;
  // “Faltam N jogadores de linha para sortear.” quando não dá para sortear
  blockedText: string | null;
  // a proposta anterior caiu porque a lista mudou
  staleText: string | null;
  failureMessage: string | null;
  isSorting: boolean;
  onSort: () => void;
  onOpenAttendance: () => void;
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
    <Text preset="stat" color="action" style={styles.statNumber}>
      {value}
    </Text>
    <Text preset="small" color="muted" style={styles.bold}>
      {label}
    </Text>
  </View>
);

const Rule = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.rule}>
    <Text style={styles.bold}>{label}</Text>
    <Text color="muted">{value}</Text>
  </View>
);

/** S1: contagem do elenco e a ação de sortear. */
export const SortPrepareView = ({
  kicker,
  when,
  place,
  lineCount,
  goalkeeperCount,
  attendanceSummary,
  markAttendedText,
  outfieldPerTeam,
  considerPosition,
  blockedText,
  staleText,
  failureMessage,
  isSorting,
  onSort,
  onOpenAttendance,
}: TSortPrepareViewProps) => (
  <SortPage
    footer={
      <>
        {blockedText ? (
          <Text preset="small" color="muted" accessibilityRole="alert">
            {blockedText}
          </Text>
        ) : null}
        <Button
          title={SORT_RUN}
          isDisabled={blockedText !== null}
          isLoading={isSorting}
          onPress={onSort}
          accessibilityLabel={SORT_RUN}
        />
      </>
    }
  >
    <View style={styles.titleBlock}>
      <Text preset="small" color="muted" style={styles.bold}>
        {kicker}
      </Text>
      <Text preset="h1" accessibilityRole="header">
        {SORT_PREPARE}
      </Text>
      <Text color="muted">{when}</Text>
      <Text color="muted">{place}</Text>
    </View>

    {staleText ? <NoticeBanner tone="warning" text={staleText} /> : null}

    <View style={styles.hero}>
      <Text preset="h3">{SORT_PREPARE_HERO_TITLE}</Text>
      <Text preset="small" color="muted">
        {SORT_PREPARE_HERO_TEXT}
      </Text>
      <View style={styles.stats}>
        <Stat value={lineCount} label={sortLineCountLabel} />
        <Stat
          value={goalkeeperCount}
          label={sortGoalkeeperCountLabel(goalkeeperCount)}
        />
      </View>
      <Text preset="small" color="muted" style={styles.summary}>
        {attendanceSummary}
      </Text>
      {markAttendedText ? (
        <Text preset="small" style={styles.bold}>
          {markAttendedText}
        </Text>
      ) : null}
    </View>

    <View style={styles.rules}>
      <Text preset="h3">{SORT_PREPARE_RULES_TITLE}</Text>
      {outfieldPerTeam !== null ? (
        <Rule
          label={SORT_RULE_OUTFIELD}
          value={sortOutfieldPerTeam(outfieldPerTeam)}
        />
      ) : null}
      <Rule
        label={SORT_RULE_BALANCE}
        value={
          considerPosition ? SORT_BALANCE_STARS_POSITION : SORT_BALANCE_STARS
        }
      />
    </View>

    <Text preset="small" color="muted">
      {SORT_PREPARE_HINT}
    </Text>

    <Button
      title={SORT_VIEW_ATTENDANCE}
      preset="outline"
      onPress={onOpenAttendance}
      accessibilityLabel={SORT_VIEW_ATTENDANCE}
      accessibilityHint="Abre a lista de presença"
    />

    {failureMessage ? <SortFailure message={failureMessage} /> : null}
  </SortPage>
);

const styles = StyleSheet.create({
  bold: { fontFamily: "Manrope-Bold" },
  titleBlock: { gap: 4 },
  hero: {
    gap: theme.space[8],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: theme.space[8],
  },
  stat: { alignItems: "center", minWidth: 96 },
  summary: { textAlign: "center" },
  statNumber: { fontSize: 40, lineHeight: 40, fontVariant: ["tabular-nums"] },
  rules: { gap: theme.space[8] },
  rule: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
});
