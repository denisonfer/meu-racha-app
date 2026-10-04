import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_KEEPER_FIRST,
  MATCH_QUEUE_NEXT,
  MATCH_TEAMS_QUEUE,
  SORT_GOALKEEPER_QUEUE,
  SORT_INCOMPLETE,
  sortGoalkeeperQueuePosition,
  sortTeamTitle,
} from "../../utils/racha-messages";

export type TMatchTeamQueueRow = {
  teamId: string;
  teamNumber: number;
  queueOrder: number;
  winStreak: number;
  isComplete: boolean;
};

export type TMatchKeeperQueueRow = {
  personId: string;
  name: string;
  queueOrder: number;
};

type TMatchQueueProps = {
  teams: TMatchTeamQueueRow[];
  keepers: TMatchKeeperQueueRow[];
};

export const MatchQueue = ({ teams, keepers }: TMatchQueueProps) => {
  // 1 e 2 já estão no card do confronto; o badge marca quem entra depois
  const nextTeamId = teams.find((team) => team.queueOrder > 2)?.teamId;

  return (
    <View style={styles.block}>
      <Text preset="h3" accessibilityRole="header">
        {MATCH_TEAMS_QUEUE}
      </Text>
      {teams.map((team) => {
        const isNext = team.teamId === nextTeamId;
        const title = `${team.queueOrder} · ${sortTeamTitle(team.teamNumber)}`;
        return (
          <View
            key={team.teamId}
            style={styles.row}
            accessibilityLabel={
              isNext ? `${title}, ${MATCH_QUEUE_NEXT}` : title
            }
          >
            <View style={styles.identity}>
              <Text preset="body">{title}</Text>
              {isNext ? (
                <View style={styles.badge}>
                  <Text
                    preset="caption"
                    color="action"
                    style={styles.badgeLabel}
                  >
                    {MATCH_QUEUE_NEXT}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text preset="caption" color="muted">
              {team.isComplete
                ? team.winStreak > 0
                  ? `${team.winStreak} seguidas`
                  : ""
                : SORT_INCOMPLETE}
            </Text>
          </View>
        );
      })}
      {keepers.length > 0 ? (
        <>
          <Text
            preset="h3"
            accessibilityRole="header"
            style={styles.keeperTitle}
          >
            {SORT_GOALKEEPER_QUEUE}
          </Text>
          {keepers.map((keeper, index) => (
            <View
              key={keeper.personId}
              style={[styles.row, index === 0 && styles.first]}
            >
              <Text preset="body" color={index === 0 ? "action" : "foreground"}>
                {keeper.name}
              </Text>
              <Text preset="caption" color={index === 0 ? "action" : "muted"}>
                {index === 0
                  ? MATCH_KEEPER_FIRST
                  : sortGoalkeeperQueuePosition(keeper.queueOrder)}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: theme.space[8],
    marginBottom: theme.space[16],
  },
  keeperTitle: { marginTop: theme.space[8] },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: theme.space[8],
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.actionDisabled,
  },
  badgeLabel: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: theme.minTouch,
    paddingVertical: theme.space[8],
    paddingHorizontal: theme.space[8],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    gap: theme.space[8],
  },
  first: {
    borderWidth: 1,
    borderColor: theme.colors.action,
    backgroundColor: theme.colors.surfaceRaised,
  },
});
