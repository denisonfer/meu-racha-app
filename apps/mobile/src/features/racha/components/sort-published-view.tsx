import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import {
  SORT_CONFIRMED_TITLE,
  SORT_INCLUDE_PERSON,
} from "../utils/racha-messages";
import { TeamsDefinedTag } from "./teams-defined-tag";
import { SortBalanceCard } from "./sort-balance-card";
import { SortFailure } from "./sort-failure";
import { SortPage } from "./sort-page";
import { SortPersonList, type TSortPersonListRow } from "./sort-person-list";
import { SortTeams, type TSortTeamsProps } from "./sort-teams";

export type TSortPublishedSection = {
  key: string;
  title: string;
  rows: TSortPersonListRow[];
};

type TSortPublishedViewProps = TSortTeamsProps & {
  when: string;
  place: string;
  scoreText: string;
  scoreLabel: string;
  scoreCaption: string;
  scoreAccessibilityLabel: string;
  // fila do gol, Aguardando inclusão e Saíram
  sections: TSortPublishedSection[];
  failureMessage: string | null;
  // só o Condutor recebe o comando de incluir
  onInclude: (() => void) | null;
};

/** S3: os mesmos Times para todos; as ações vêm prontas por papel. */
export const SortPublishedView = ({
  when,
  place,
  scoreText,
  scoreLabel,
  scoreCaption,
  scoreAccessibilityLabel,
  superWarnings,
  teams,
  sections,
  failureMessage,
  onInclude,
}: TSortPublishedViewProps) => {
  const content = (
    <>
      <View style={styles.titleBlock}>
        <TeamsDefinedTag />
        <Text preset="h1" accessibilityRole="header">
          {SORT_CONFIRMED_TITLE}
        </Text>
        <Text color="muted">
          {when} · {place}
        </Text>
      </View>

      <SortBalanceCard
        scoreText={scoreText}
        label={scoreLabel}
        caption={scoreCaption}
        accessibilityLabel={scoreAccessibilityLabel}
      />

      <SortTeams superWarnings={superWarnings} teams={teams} />

      {sections.map((section) => (
        <SortPersonList
          key={section.key}
          title={section.title}
          rows={section.rows}
        />
      ))}

      {failureMessage ? <SortFailure message={failureMessage} /> : null}
    </>
  );

  return onInclude ? (
    <SortPage
      footer={
        <Button
          title={SORT_INCLUDE_PERSON}
          onPress={onInclude}
          accessibilityHint="Abre a lista de quem pode entrar"
        />
      }
    >
      {content}
    </SortPage>
  ) : (
    <SortPage footer={null}>{content}</SortPage>
  );
};

const styles = StyleSheet.create({
  titleBlock: { gap: 6, alignItems: "flex-start" },
});
