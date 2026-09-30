import { StyleSheet, Switch, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { StarRating } from "./star-rating";

const SUPER_STAR_HINT = "O sorteio espalha os Super Estrelas entre os times.";

export type TStarsAndSuperStarFieldProps = {
  isGoalkeeper: boolean;
  stars: number | null;
  onStarsChange: (value: number) => void;
  isSuperStar: boolean;
  onSuperStarChange: (value: boolean) => void;
  isDisabled: boolean;
};

export const StarsAndSuperStarField = ({
  isGoalkeeper,
  stars,
  onStarsChange,
  isSuperStar,
  onSuperStarChange,
  isDisabled,
}: TStarsAndSuperStarFieldProps) => {
  const starsWord = stars === 1 ? "Estrela" : "Estrelas";

  return (
    <>
      {isGoalkeeper ? (
        <View style={styles.goalkeeperBox}>
          <Text style={styles.goalkeeperTag}>GOL</Text>
          <Text preset="small" color="muted" style={[styles.bold, styles.grow]}>
            sem Estrelas. Quem joga no Gol não tem Estrelas nem Super Estrela.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.starsBlock}>
            <View style={styles.texts}>
              <Text style={styles.bold}>Estrelas</Text>
              <Text preset="small">
                A nota que o sorteio usa para equilibrar os times. Todos os
                membros veem.
              </Text>
            </View>
            <StarRating
              value={stars}
              onChange={onStarsChange}
              isDisabled={isDisabled}
            />
            <View accessibilityLiveRegion="polite" style={styles.starsStatus}>
              {stars === null ? (
                <Text preset="small" style={styles.bold}>
                  Escolha as Estrelas
                </Text>
              ) : (
                <>
                  <Text style={styles.starsNumber}>{stars}</Text>
                  <Text preset="small" style={styles.bold}>
                    {starsWord}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.superStarRow}>
            <View style={[styles.texts, styles.grow]}>
              <Text style={styles.bold}>Super Estrela</Text>
              <Text preset="small">{SUPER_STAR_HINT}</Text>
            </View>
            <Switch
              value={isSuperStar}
              onValueChange={onSuperStarChange}
              disabled={isDisabled}
              accessibilityLabel="Super Estrela"
              accessibilityHint={SUPER_STAR_HINT}
              trackColor={{
                false: theme.colors.mutedDisabled,
                true: theme.colors.action,
              }}
              thumbColor={
                isSuperStar ? theme.colors.onAction : theme.colors.muted
              }
            />
          </View>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  texts: { gap: 2 },
  starsBlock: { gap: 10 },
  starsStatus: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    minHeight: 24,
  },
  starsNumber: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  superStarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
    paddingTop: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  goalkeeperBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.background,
  },
  goalkeeperTag: {
    ...theme.text.stat,
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: 1,
  },
});
