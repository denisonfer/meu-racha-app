import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_REMATCH,
  MATCH_START,
  matchKeeperLine,
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
      <View style={styles.incomplete}>
        <Text preset="h3">{team}</Text>
      </View>
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

    <View style={styles.sides}>
      <SideCard {...home} />
      <Text preset="h2" style={styles.vs}>
        x
      </Text>
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
  vs: { alignSelf: "center" },
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
  incomplete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
