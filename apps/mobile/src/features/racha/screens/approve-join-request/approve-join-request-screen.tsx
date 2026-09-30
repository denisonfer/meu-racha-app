import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Avatar, Button, Icon, Text } from "@/ui/components";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { theme } from "@/ui/theme";
import { StarRating } from "../../components/star-rating";
import { useApproveJoinRequestScreen } from "./use-approve-join-request-screen";

const SUPER_STAR_HINT = "O sorteio espalha os Super Estrelas entre os times.";

export const ApproveJoinRequestScreen = () => {
  const {
    person,
    isGoalkeeper,
    stars,
    setStars,
    starsWord,
    isSuperStar,
    setIsSuperStar,
    canApprove,
    failureMessage,
    isApproving,
    confirm,
    close,
  } = useApproveJoinRequestScreen();
  const { bottom } = useAppSafeArea();

  if (!person) return null;

  return (
    <View
      accessibilityViewIsModal
      style={[styles.sheet, { paddingBottom: bottom }]}
    >
      <View style={styles.header}>
        <Avatar name={person.name} photoUrl={person.photoUrl} size={48} />
        <View style={styles.headerTexts}>
          <Text preset="h2" accessibilityRole="header">
            {person.title}
          </Text>
          <Text preset="small" style={styles.bold}>
            {person.summary}
          </Text>
          {person.belowMinAgeText ? (
            <Text preset="small" color="warning" style={styles.bold}>
              {person.belowMinAgeText}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={close}
          disabled={isApproving}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          accessibilityState={{ disabled: isApproving }}
          style={styles.closeButton}
        >
          <Icon name="close" size={22} />
        </Pressable>
      </View>

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
              onChange={setStars}
              isDisabled={isApproving}
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
              onValueChange={setIsSuperStar}
              disabled={isApproving}
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

      <View style={styles.footer}>
        <Text preset="small">Entra no racha como JOGADOR.</Text>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Aprovar"
          onPress={confirm}
          isDisabled={!canApprove}
          isLoading={isApproving}
          accessibilityLabel={isApproving ? "Aprovando" : "Aprovar"}
          accessibilityHint={
            canApprove ? undefined : "Escolha as Estrelas primeiro"
          }
          style={styles.approveButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    gap: 20,
    paddingTop: theme.space[24],
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surfaceRaised,
  },
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  texts: { gap: 2 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerTexts: { flex: 1, gap: 2, paddingTop: 2 },
  closeButton: {
    width: theme.minTouch,
    height: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    marginRight: -10,
  },
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
  footer: { gap: 10 },
  approveButton: { minHeight: 56 },
});
