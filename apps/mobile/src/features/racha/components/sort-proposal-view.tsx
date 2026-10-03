import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  SORT_CONFIRM_NOTE,
  SORT_CONFIRM_TEAMS,
  SORT_GOALKEEPERS_HINT,
  SORT_GOALKEEPERS_TITLE,
  SORT_NOT_PUBLISHED,
  SORT_PROPOSAL_SUBTITLE,
  SORT_PROPOSAL_TITLE,
  SORT_RERUN,
} from "../utils/racha-messages";
import { SortBalanceCard } from "./sort-balance-card";
import { SortFailure } from "./sort-failure";
import { SortPage } from "./sort-page";
import { SortPersonList, type TSortPersonListRow } from "./sort-person-list";
import { SortTeams, type TSortTeamsProps } from "./sort-teams";

type TSortProposalViewProps = TSortTeamsProps & {
  scoreText: string;
  scoreLabel: string;
  scoreCaption: string;
  scoreAccessibilityLabel: string;
  goalkeeperRows: TSortPersonListRow[];
  failureMessage: string | null;
  isBusy: boolean;
  isRerunning: boolean;
  onRerun: () => void;
  onConfirm: () => void;
};

/** S2: proposta que só o Condutor vê, com re-sorteio, troca de Goleiros e confirmação. */
export const SortProposalView = ({
  scoreText,
  scoreLabel,
  scoreCaption,
  scoreAccessibilityLabel,
  superWarnings,
  teams,
  goalkeeperRows,
  failureMessage,
  isBusy,
  isRerunning,
  onRerun,
  onConfirm,
}: TSortProposalViewProps) => (
  <SortPage
    footer={
      <>
        <View style={styles.buttons}>
          <Button
            title={SORT_RERUN}
            preset="outline"
            isLoading={isRerunning}
            isDisabled={isBusy && !isRerunning}
            onPress={onRerun}
            style={styles.button}
          />
          <Button
            title={SORT_CONFIRM_TEAMS}
            isDisabled={isBusy}
            onPress={onConfirm}
            accessibilityHint="Abre a confirmação"
            style={styles.button}
          />
        </View>
        <Text preset="caption" color="muted" style={styles.note}>
          {SORT_CONFIRM_NOTE}
        </Text>
      </>
    }
  >
    <View style={styles.titleBlock}>
      <View style={styles.badge}>
        <Text preset="caption" color="action" style={styles.badgeLabel}>
          {SORT_NOT_PUBLISHED.toUpperCase()}
        </Text>
      </View>
      <Text preset="h1" accessibilityRole="header">
        {SORT_PROPOSAL_TITLE}
      </Text>
      <Text color="muted">{SORT_PROPOSAL_SUBTITLE}</Text>
    </View>

    <SortBalanceCard
      scoreText={scoreText}
      label={scoreLabel}
      caption={scoreCaption}
      accessibilityLabel={scoreAccessibilityLabel}
    />

    <SortTeams superWarnings={superWarnings} teams={teams} />

    {goalkeeperRows.length > 0 ? (
      <SortPersonList
        title={SORT_GOALKEEPERS_TITLE}
        hint={goalkeeperRows.length > 1 ? SORT_GOALKEEPERS_HINT : undefined}
        rows={goalkeeperRows}
      />
    ) : null}

    {failureMessage ? <SortFailure message={failureMessage} /> : null}
  </SortPage>
);

const styles = StyleSheet.create({
  titleBlock: { gap: 6, alignItems: "flex-start" },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.actionDisabled,
  },
  badgeLabel: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
  buttons: { flexDirection: "row", gap: 10 },
  button: { flex: 1 },
  note: { textAlign: "center" },
});
