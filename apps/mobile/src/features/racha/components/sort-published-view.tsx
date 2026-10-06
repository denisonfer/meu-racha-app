import { StyleSheet, View } from "react-native";
import { Bolinha, Button, Text } from "@/ui/components";
import {
  BOLINHAS,
  BOLINHAS_UNAVAILABLE_A11Y,
  MATCH_VIEW,
  SORT_CONFIRMED_TITLE,
  SORT_INCLUDE_PERSON,
} from "../utils/racha-messages";
import { ChangeNote } from "./change-note";
import { TeamsDefinedTag } from "./teams-defined-tag";
import { SortBalanceCard } from "./sort-balance-card";
import { SortFailure } from "./sort-failure";
import { SortPage } from "./sort-page";
import { SortPersonList, type TSortPersonListRow } from "./sort-person-list";
import { SortTeams, type TSortTeamsProps } from "./sort-teams";

export type TSortPublishedSection = {
  key: string;
  title: string;
  hint?: string;
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
  onOpenMatch: (() => void) | null;
  // Bolinhas: só o Condutor recebe o comando
  onOpenBolinhas: (() => void) | null;
  // com o botão desabilitado, o motivo vem escrito embaixo
  bolinhasDisabledReason: string | null;
  changeNote: TChangeNote | null;
};

export type TChangeNote = { title: string; caption: string };

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
  onOpenMatch,
  onOpenBolinhas,
  bolinhasDisabledReason,
  changeNote,
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
        {onOpenMatch || onOpenBolinhas ? (
          <View style={styles.buttons}>
            {onOpenMatch ? (
              <Button
                title={MATCH_VIEW}
                preset="secondary"
                onPress={onOpenMatch}
                accessibilityHint="Abre a tela da Partida"
                style={styles.flex}
              />
            ) : null}
            {onOpenBolinhas ? (
              <Button
                title={BOLINHAS}
                icon="bolinhas"
                preset="outline"
                onPress={onOpenBolinhas}
                isDisabled={bolinhasDisabledReason !== null}
                accessibilityLabel={
                  bolinhasDisabledReason ? BOLINHAS_UNAVAILABLE_A11Y : BOLINHAS
                }
                style={styles.flex}
              />
            ) : null}
          </View>
        ) : null}
        {bolinhasDisabledReason ? (
          <Text preset="small" color="muted">
            {bolinhasDisabledReason}
          </Text>
        ) : null}
      </View>

      {changeNote ? (
        <ChangeNote
          icon={<Bolinha state="blue" size={28} />}
          title={changeNote.title}
          caption={changeNote.caption}
        />
      ) : null}

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
          hint={section.hint}
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
  buttons: { alignSelf: "stretch", flexDirection: "row", gap: 8, marginTop: 2 },
  flex: { flex: 1 },
});
