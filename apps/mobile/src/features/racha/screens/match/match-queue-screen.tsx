import { ScrollView, StyleSheet } from "react-native";
import { FixedBottomSheet, Text } from "@/ui/components";
import {
  MATCH_QUEUE_EMPTY,
  MATCH_QUEUE_SHEET_TITLE,
} from "../../utils/racha-messages";
import { MatchHistory } from "./match-history";
import { MatchQueue } from "./match-queue";
import { useMatchQueueScreen } from "./use-match-queue-screen";

export const MatchQueueScreen = () => {
  const { teams, keepers, history } = useMatchQueueScreen();

  return (
    <FixedBottomSheet title={MATCH_QUEUE_SHEET_TITLE}>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {teams.length === 0 ? (
          <Text color="muted">{MATCH_QUEUE_EMPTY}</Text>
        ) : null}
        <MatchQueue teams={teams} keepers={keepers} />
        <MatchHistory matches={history} />
      </ScrollView>
    </FixedBottomSheet>
  );
};

const styles = StyleSheet.create({
  list: { maxHeight: 420 },
});
