import { useLocalSearchParams } from "expo-router";
import { useEventMatch } from "../../hooks/use-event-match";
import { matchHistoryItems, matchQueueRows } from "./match-format";

export function useMatchQueueScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  return {
    ...matchQueueRows(matchQuery.data),
    history: matchHistoryItems(matchQuery.data, null),
  };
}
