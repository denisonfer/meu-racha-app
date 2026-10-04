import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_REMATCH,
  MATCH_START,
  matchIncompleteTeam,
  matchKeeperLine,
  matchVsLine,
  sortTeamTitle,
} from "../../utils/racha-messages";

type TMatchBetweenSide = {
  teamId: string;
  teamNumber: number;
  keeperName: string | null;
  isComplete: boolean;
  onSwapKeeper: (() => void) | null;
};

type TMatchBetweenProps = {
  home: TMatchBetweenSide;
  away: TMatchBetweenSide;
  isRematch: boolean;
  canStart: boolean;
  isStartDisabled: boolean;
  isStartBusy: boolean;
  onStart: () => void;
};

const SideCard = ({
  teamNumber,
  keeperName,
  isComplete,
  onSwapKeeper,
}: TMatchBetweenSide) => {
  const team = sortTeamTitle(teamNumber);
  return (
    <View style={styles.side}>
      <Text preset="h3">{team}</Text>
      {keeperName ? (
        onSwapKeeper ? (
          <Pressable
            onPress={onSwapKeeper}
            accessibilityRole="button"
            accessibilityLabel={`Trocar goleiro do ${team}`}
            style={styles.keeperHit}
          >
            <Text preset="small" color="action">
              {matchKeeperLine(keeperName)}
            </Text>
          </Pressable>
        ) : (
          <Text preset="small" color="muted">
            {matchKeeperLine(keeperName)}
          </Text>
        )
      ) : null}
      {!isComplete ? (
        <Text preset="small" color="warning">
          {matchIncompleteTeam(teamNumber)}
        </Text>
      ) : null}
    </View>
  );
};

export const MatchBetween = ({
  home,
  away,
  isRematch,
  canStart,
  isStartDisabled,
  isStartBusy,
  onStart,
}: TMatchBetweenProps) => (
  <View style={styles.block}>
    {isRematch ? (
      <Text preset="caption" color="warning">
        {MATCH_REMATCH}
      </Text>
    ) : null}
    <Text preset="h2" style={styles.vs}>
      {matchVsLine(home.teamNumber, away.teamNumber)}
    </Text>
    <View style={styles.sides}>
      <SideCard {...home} />
      <SideCard {...away} />
    </View>
    {canStart ? (
      <Button
        title={MATCH_START}
        onPress={onStart}
        isDisabled={isStartDisabled}
        isLoading={isStartBusy}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  block: {
    gap: theme.space[16],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.space[16],
  },
  vs: { textAlign: "center" },
  sides: { flexDirection: "row", gap: theme.space[8] },
  side: {
    flex: 1,
    gap: theme.space[8],
    padding: theme.space[8],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceRaised,
  },
  keeperHit: {
    minHeight: theme.minTouch,
    justifyContent: "center",
  },
});
