import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RoleChip } from "../../components/role-chip";
import { RulesSummary } from "../../components/rules-summary";
import { useRachaHomeScreen } from "./use-racha-home-screen";

export const RachaHomeScreen = () => {
  const { racha, isLoading, retry, isRetrying, shareInvite, backToRachas } =
    useRachaHomeScreen();

  return (
    <Screen canGoBack onGoBack={backToRachas} isScrollable>
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
            <View style={styles.roleRow}>
              {racha.isOwner ? <RoleChip role="OWNER" /> : null}
              <Text preset="small" color="muted">
                {racha.membersLabel}
              </Text>
            </View>
          </View>

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
  roleRow: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  rules: {
    gap: theme.space[4],
    paddingVertical: 14,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
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
