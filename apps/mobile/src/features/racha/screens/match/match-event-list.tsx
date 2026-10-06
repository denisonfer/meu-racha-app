import { Pressable, StyleSheet, View } from "react-native";
import { Icon, PenaltyCard, Text, type TIconName } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MatchGoalText } from "./match-goal-text";
import {
  MATCH_DELETE_GOAL,
  MATCH_EVENTS_TITLE,
} from "../../utils/racha-messages";

export type TMatchGoalEventRow = {
  kind: "goal";
  id: string;
  scorer: string;
  assist: string | null;
  label: string;
  onDelete: (() => void) | null;
};

export type TMatchRosterEventRow = {
  kind: "roster";
  id: string;
  title: string;
  text: string;
  detail: string | null;
  label: string;
  icon: TIconName;
};

export type TMatchCardEventRow = {
  kind: "card";
  id: string;
  color: "yellow" | "red";
  title: string;
  text: string;
  detail: string;
  label: string;
  onDelete: (() => void) | null;
};

export type TMatchEventRow =
  TMatchGoalEventRow | TMatchRosterEventRow | TMatchCardEventRow;

type TMatchEventListProps = {
  events: TMatchEventRow[];
};

export const MatchEventList = ({ events }: TMatchEventListProps) => (
  <View style={styles.list}>
    <Text preset="h3" accessibilityRole="header">
      {MATCH_EVENTS_TITLE}
    </Text>
    {events.map((event) =>
      event.kind === "goal" ? (
        <View key={event.id} style={styles.row}>
          <MatchGoalText
            scorer={event.scorer}
            assist={event.assist}
            label={event.label}
            preset="body"
          />
          {event.onDelete ? (
            <Pressable
              onPress={event.onDelete}
              accessibilityRole="button"
              accessibilityLabel={`${MATCH_DELETE_GOAL} ${event.label}`}
              style={styles.delete}
            >
              <Text preset="caption" color="danger">
                {MATCH_DELETE_GOAL}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : event.kind === "card" ? (
        <View key={event.id} style={styles.row}>
          <PenaltyCard color={event.color} size="md" />
          <View
            accessible
            accessibilityLabel={`${event.label}. ${event.detail}`}
            style={styles.texts}
          >
            <Text preset="body">
              <Text preset="body" style={styles.term}>
                {event.title}
              </Text>
              {` · ${event.text}`}
            </Text>
            <Text preset="caption" color="muted">
              {event.detail}
            </Text>
          </View>
          {event.onDelete ? (
            <Pressable
              onPress={event.onDelete}
              accessibilityRole="button"
              accessibilityLabel={`${MATCH_DELETE_GOAL} ${event.label}`}
              style={styles.delete}
            >
              <Text preset="caption" color="danger">
                {MATCH_DELETE_GOAL}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View
          key={event.id}
          accessible
          accessibilityLabel={event.label}
          style={styles.row}
        >
          <Icon name={event.icon} size={18} color="muted" />
          <View style={styles.texts}>
            <Text preset="body">
              <Text preset="body" style={styles.term}>
                {event.title}
              </Text>
              {` · ${event.text}`}
            </Text>
            {event.detail ? (
              <Text preset="caption" color="muted">
                {event.detail}
              </Text>
            ) : null}
          </View>
        </View>
      )
    )}
  </View>
);

const styles = StyleSheet.create({
  list: { gap: theme.space[8], paddingBottom: theme.space[16] },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: theme.minTouch,
    paddingVertical: theme.space[8],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
    gap: theme.space[8],
  },
  texts: { flex: 1, gap: theme.space[8] / 2 },
  term: { fontFamily: "Manrope-Bold" },
  delete: {
    minHeight: theme.minTouch,
    minWidth: theme.minTouch,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: theme.space[8],
  },
});
