import { StyleSheet, View } from "react-native";
import { NoticeBanner } from "@/ui/components";
import { SORT_SUPER_WARNING_TITLE } from "../utils/racha-messages";
import { SortTeamCard, type TSortTeamCardProps } from "./sort-team-card";

export type TSortTeamsProps = {
  // uma frase por Time com Super Estrelas que o Sorteio não separou
  superWarnings: string[];
  teams: (TSortTeamCardProps & { key: string })[];
};

/** O conjunto de Times da proposta e dos publicados: a mesma composição nas duas telas. */
export const SortTeams = ({ superWarnings, teams }: TSortTeamsProps) => (
  <>
    {superWarnings.length > 0 ? (
      <NoticeBanner
        tone="warning"
        title={SORT_SUPER_WARNING_TITLE}
        text={superWarnings.join(" ")}
      />
    ) : null}
    <View style={styles.list}>
      {teams.map(({ key, ...team }) => (
        <SortTeamCard key={key} {...team} />
      ))}
    </View>
  </>
);

const styles = StyleSheet.create({ list: { gap: 10 } });
