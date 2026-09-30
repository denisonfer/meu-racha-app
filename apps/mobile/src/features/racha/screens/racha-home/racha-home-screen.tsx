import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Icon, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RulesSummary } from "../../components/rules-summary";
import { useRachaHomeScreen } from "./use-racha-home-screen";

export const RachaHomeScreen = () => {
  const {
    racha,
    isLoading,
    retry,
    isRetrying,
    shareInvite,
    backToRachas,
    openRequests,
    openMembers,
    openSettings,
    canLeave,
    openLeave,
  } = useRachaHomeScreen();

  return (
    <Screen
      canGoBack
      onGoBack={backToRachas}
      isScrollable
      headerRight={
        racha?.isOwner ? (
          <Pressable
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Configurações do racha"
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="settings" size={24} />
          </Pressable>
        ) : undefined
      }
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : !racha ? (
        <EmptyState
          title="Não deu pra abrir o racha"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text preset="h1" style={styles.extraBold}>
              {racha.name}
            </Text>
          </View>

          {racha.pendingRow ? (
            <Pressable
              onPress={openRequests}
              accessibilityRole="button"
              accessibilityLabel={racha.pendingRow.label}
              style={({ pressed }) => [
                styles.pendingRow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.pendingCount}>{racha.pendingRow.count}</Text>
              <View style={styles.grow}>
                <Text style={styles.bold}>{racha.pendingRow.word}</Text>
                <Text preset="small">Aprove ou recuse quem pediu.</Text>
              </View>
              <Icon name="chevron-right" />
            </Pressable>
          ) : null}

          <View style={styles.groupCard}>
            <Pressable
              onPress={openMembers}
              accessibilityRole="button"
              accessibilityLabel={`Membros, ${racha.memberCount}`}
              style={({ pressed }) => [
                styles.membersRow,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="users" color="muted" size={22} />
              <Text style={[styles.grow, styles.membersLabel]}>
                Membros <Text color="muted">· </Text>
                <Text style={styles.membersCount}>{racha.memberCount}</Text>
              </Text>
              <Icon name="chevron-right" color="muted" />
            </Pressable>

            <View style={styles.divider} />

            {racha.isOwner ? (
              <Pressable
                onPress={openSettings}
                accessibilityRole="button"
                accessibilityLabel={`Regras do jogo: ${racha.summary.join(", ")}`}
                accessibilityHint="Abre as configurações do racha"
                style={({ pressed }) => [
                  styles.rulesRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rulesTexts}>
                  <Text preset="small" color="muted" style={styles.bold}>
                    Regras do jogo
                  </Text>
                  <RulesSummary parts={racha.summary} />
                </View>
                <Icon name="chevron-right" color="muted" />
              </Pressable>
            ) : (
              <View
                style={styles.rules}
                accessible
                accessibilityLabel={`Regras do jogo: ${racha.summary.join(", ")}`}
              >
                <Text preset="small" color="muted" style={styles.bold}>
                  Regras do jogo
                </Text>
                <RulesSummary parts={racha.summary} />
              </View>
            )}
          </View>

          {racha.isOwner ? (
            <View style={styles.steps}>
              <Text preset="h2">Próximos passos</Text>

              <View style={[styles.step, styles.stepHighlighted]}>
                <StepHeading
                  number={1}
                  isHighlighted
                  title="Compartilhar convite"
                  text="Mande o link ou o código. Quem entrar vira membro do racha."
                />
                <View
                  style={styles.codeBox}
                  accessible
                  accessibilityLabel={`Código do racha: ${racha.inviteCode.split("").join(" ")}`}
                >
                  <Text preset="caption" color="muted" style={styles.bold}>
                    Código do racha
                  </Text>
                  <Text style={styles.code}>{racha.inviteCode}</Text>
                </View>
                <Button title="Compartilhar convite" onPress={shareInvite} />
              </View>

              <View style={styles.step}>
                <StepHeading
                  number={2}
                  title="Criar o primeiro evento"
                  text="Marque dia, hora e local. A galera confirma presença por lá."
                />

                <Button
                  title="Criar evento"
                  preset="secondary"
                  onPress={() => {}}
                />
              </View>
            </View>
          ) : (
            <View style={styles.nextEventCard}>
              <Text preset="small" color="muted" style={styles.bold}>
                Próximo evento
              </Text>
              <Text style={styles.bold}>Nenhum evento marcado</Text>
              <Text preset="small" color="muted">
                Quando o dono marcar o próximo jogo, ele aparece aqui.
              </Text>
            </View>
          )}

          {canLeave ? (
            <View style={styles.leaveZone}>
              <Button
                preset="destructiveOutline"
                title="Deixar o racha"
                accessibilityHint="Abre a confirmação"
                onPress={openLeave}
                style={styles.leaveButton}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
};

type TStepHeadingProps = {
  number: number;
  title: string;
  text: string;
  isHighlighted?: boolean;
};

const StepHeading = ({
  number,
  title,
  text,
  isHighlighted = false,
}: TStepHeadingProps) => (
  <View style={styles.stepHeading}>
    <Text
      preset="stat"
      color={isHighlighted ? "action" : "muted"}
      style={styles.stepNumber}
    >
      {number}
    </Text>
    <View style={styles.stepTexts}>
      <Text preset="h3">{title}</Text>
      <Text preset="small" color={isHighlighted ? "foreground" : "muted"}>
        {text}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  content: { gap: 20 },
  titleBlock: { gap: theme.space[8] },
  extraBold: { fontFamily: "Manrope-ExtraBold" },
  bold: { fontFamily: "Manrope-Bold" },

  grow: { flex: 1 },
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    width: theme.minTouch,
    height: theme.minTouch,
    marginVertical: -10,
    marginRight: -10,
  },
  pressed: { opacity: 0.8 },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
  },
  pendingCount: {
    ...theme.text.stat,
    minWidth: 24,
    fontSize: 34,
    lineHeight: 34,
    color: theme.colors.action,
    fontVariant: ["tabular-nums"],
  },
  groupCard: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  membersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  membersLabel: { fontFamily: "Manrope-Bold" },
  membersCount: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  rules: {
    gap: theme.space[4],
    paddingTop: 14,
    paddingBottom: theme.space[16],
    paddingHorizontal: theme.space[16],
  },
  rulesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingTop: 14,
    paddingBottom: theme.space[16],
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  rulesTexts: { flex: 1, gap: theme.space[4] },
  nextEventCard: {
    gap: 2,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  leaveZone: {
    paddingTop: theme.space[32],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  leaveButton: { minHeight: 48 },
  steps: { gap: 12 },
  step: {
    gap: theme.space[16],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  stepHighlighted: {
    padding: 14, // compensa a borda de 2
    borderWidth: 2,
    borderColor: theme.colors.action,
    backgroundColor: theme.colors.surfaceRaised,
  },
  stepHeading: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNumber: { width: 24, fontSize: 32, lineHeight: 32 },
  stepTexts: { flex: 1, gap: theme.space[4] },
  codeBox: {
    justifyContent: "center",
    gap: 2,
    height: 64,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.background,
  },
  code: {
    ...theme.text.stat,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
});
