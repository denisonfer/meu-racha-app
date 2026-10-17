import { ScrollView, StyleSheet } from "react-native";
import { BottomSheet, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SortPersonList } from "../../components/sort-person-list";
import { MATCH_ROSTER_TEXT } from "../../utils/racha-messages";
import { useMatchRosterScreen } from "./use-match-roster-screen";

export const MatchRosterScreen = () => {
  const { isMissing, title, listTitle, rows } = useMatchRosterScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={<Text color="muted">{MATCH_ROSTER_TEXT}</Text>}
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <SortPersonList title={listTitle} rows={rows} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  list: { maxHeight: 360 },
  listContent: { gap: theme.space[8] },
});
