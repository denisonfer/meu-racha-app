import {
  DEFAULT_RACHA_RULES,
  MAX_WINS_MAX,
  MAX_WINS_MIN,
  OUTFIELD_PER_TEAM_MAX,
  OUTFIELD_PER_TEAM_MIN,
  TGameMode,
  TRachaRules,
  TTieReturnOrder,
  TTieRule,
  TYellowCardMode,
  YELLOW_OUT_MAX,
  YELLOW_OUT_MIN,
} from "@meu-racha/domain";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ChipGroup, Icon, OptionList, Stepper, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { OptionalNumberField } from "./optional-number-field";
import { RulesSummary } from "./rules-summary";

const TIE_RULE_OPTIONS: { value: TTieRule; label: string }[] = [
  { value: "BOTH_OUT", label: "Sai ambos" },
  { value: "BOTH_STAY", label: "Fica ambos" },
  { value: "PENALTIES", label: "Pênaltis" },
  { value: "CHALLENGER_WINS", label: "Desafiante leva" },
];

const TIE_RULE_DESCRIPTION: Record<TTieRule, string> = {
  BOTH_OUT: "Os dois times saem e os próximos da fila entram.",
  BOTH_STAY: "Os dois ficam para uma revanche, uma vez só.",
  PENALTIES: "Empatou, decide nos pênaltis. Quem vence fica.",
  CHALLENGER_WINS: "Empatou, fica o time que acabou de entrar.",
};

const RETURN_ORDER_OPTIONS: { value: TTieReturnOrder; label: string }[] = [
  { value: "RANDOM", label: "Por sorteio" },
  { value: "TEAM_ORDER", label: "Pela ordem dos times" },
];

const gameModeOptions = (maxWins: number) => [
  {
    value: "WINNER_STAYS" as TGameMode,
    title: "Rei da Quadra",
    description: "Quem vence fica. Quem perde vai para o fim da fila.",
  },
  {
    value: "ROTATION" as TGameMode,
    title: "Rotação",
    description: "Os dois times saem depois de cada partida.",
  },
  {
    value: "MAX_WINS" as TGameMode,
    title: "Máximo de vitórias",
    description: `Como o Rei da Quadra, mas o time sai ao bater ${maxWins} vitórias seguidas.`,
  },
];

const YELLOW_CARD_OPTIONS: {
  value: TYellowCardMode;
  title: string;
  description: string;
}[] = [
  {
    value: "timed",
    title: "Minutos fora",
    description:
      "Sai pelo relógio da Partida e volta sozinha. Nenhum cartão chama Reforço.",
  },
  {
    value: "mark",
    title: "Advertência",
    description:
      "Continua em campo, marcada de amarelo. O segundo amarelo na mesma Partida vira vermelho.",
  },
];

type TRulesSectionProps = {
  rules: TRachaRules;
  summary: string[];
  onChange: <K extends keyof TRachaRules>(
    key: K,
    value: TRachaRules[K]
  ) => void;
  isExpanded: boolean;
  onToggle: () => void;
  isDisabled: boolean;
  matchDurationError?: string;
  yellowOutError?: string;
  isHintVisible?: boolean;
  lockMessage?: string | null;
};

export const RulesSection = ({
  rules,
  summary,
  onChange,
  isExpanded,
  onToggle,
  isDisabled,
  matchDurationError,
  yellowOutError,
  isHintVisible = true,
  lockMessage = null,
}: TRulesSectionProps) => {
  return (
    <View style={[styles.card, isDisabled && styles.cardDisabled]}>
      <Pressable
        onPress={onToggle}
        disabled={isDisabled && !lockMessage}
        accessibilityRole="button"
        accessibilityLabel={`Regras do jogo: ${summary.join(", ")}`}
        accessibilityHint={isExpanded ? "Recolher" : "Ajustar as regras"}
        accessibilityState={{
          expanded: isExpanded,
          disabled: isDisabled && !lockMessage,
        }}
        style={styles.header}
      >
        <View style={styles.headerTexts}>
          <Text preset="h3">Regras do jogo</Text>
          <RulesSummary parts={summary} />
          {lockMessage ? (
            <Text preset="small" color="muted">
              {lockMessage}
            </Text>
          ) : isExpanded || !isHintVisible ? null : (
            <Text preset="small" color="muted">
              Já vem no jeito da maioria dos rachas.
            </Text>
          )}
        </View>
        <View style={styles.toggle}>
          <Text style={styles.bold}>{isExpanded ? "Recolher" : "Ajustar"}</Text>
          <View style={isExpanded && styles.chevronUp}>
            <Icon name="chevron-down" />
          </View>
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.body}>
          <View style={styles.field}>
            <Stepper
              label="Jogadores de linha por time"
              hint="O goleiro não conta nesse número."
              value={rules.outfieldPerTeam}
              min={OUTFIELD_PER_TEAM_MIN}
              max={OUTFIELD_PER_TEAM_MAX}
              onChange={(value) => onChange("outfieldPerTeam", value)}
              isDisabled={isDisabled}
            />
          </View>

          <View style={[styles.field, styles.divided, styles.stack]}>
            <Text style={styles.bold}>Modo de jogo</Text>
            <OptionList
              options={gameModeOptions(rules.maxConsecutiveWins)}
              value={rules.gameMode}
              onChange={(value) => onChange("gameMode", value)}
              isDisabled={isDisabled}
            />
            {rules.gameMode === "MAX_WINS" ? (
              <View style={styles.raisedBox}>
                <Stepper
                  label="Vitórias seguidas"
                  hint="Ao bater esse número, o time sai."
                  value={rules.maxConsecutiveWins}
                  min={MAX_WINS_MIN}
                  max={MAX_WINS_MAX}
                  onChange={(value) => onChange("maxConsecutiveWins", value)}
                  isDisabled={isDisabled}
                />
              </View>
            ) : null}
          </View>

          {rules.gameMode === "ROTATION" ? null : (
            <View style={[styles.field, styles.divided, styles.stack]}>
              <ChipGroup
                label="Regra de empate"
                options={TIE_RULE_OPTIONS}
                value={rules.tieRule}
                onChange={(value) => onChange("tieRule", value)}
                hint={TIE_RULE_DESCRIPTION[rules.tieRule]}
                isDisabled={isDisabled}
              />
              {rules.tieRule === "BOTH_OUT" ? (
                <ChipGroup
                  label="Quem volta primeiro para a fila"
                  options={RETURN_ORDER_OPTIONS}
                  value={rules.tieReturnOrder}
                  onChange={(value) => onChange("tieReturnOrder", value)}
                  isDisabled={isDisabled}
                  isFullWidth
                />
              ) : null}
            </View>
          )}

          <View style={[styles.field, styles.divided, styles.row]}>
            <View style={styles.rowTexts}>
              <Text style={styles.bold}>Considerar posição no sorteio</Text>
              <Text preset="small" color="muted">
                Ligado, o sorteio equilibra defensores, meias e atacantes entre
                os times.
              </Text>
            </View>
            <Switch
              value={rules.considerPosition}
              onValueChange={(value) => onChange("considerPosition", value)}
              disabled={isDisabled}
              accessibilityLabel="Considerar posição no sorteio"
              trackColor={{
                false: theme.colors.mutedDisabled,
                true: theme.colors.action,
              }}
              thumbColor={
                rules.considerPosition
                  ? theme.colors.onAction
                  : theme.colors.muted
              }
              ios_backgroundColor={theme.colors.mutedDisabled}
            />
          </View>

          <View style={[styles.field, styles.divided]}>
            <OptionalNumberField
              label="Duração da partida"
              value={rules.matchDurationMin}
              onChange={(value) => onChange("matchDurationMin", value)}
              unit="min"
              noneLabel="Sem relógio"
              restoreValue={DEFAULT_RACHA_RULES.matchDurationMin!}
              hint="O app só mostra o relógio. Quem encerra a partida é o organizador."
              error={matchDurationError}
              isDisabled={isDisabled}
              accessibilityLabel="Duração da partida, em minutos"
              isOptional
            />
          </View>

          <View style={[styles.field, styles.divided, styles.stack]}>
            <Text style={styles.bold}>Cartão amarelo</Text>
            <OptionList
              options={YELLOW_CARD_OPTIONS}
              value={rules.yellowCardMode}
              onChange={(value) => onChange("yellowCardMode", value)}
              isDisabled={isDisabled}
            />
            {rules.yellowCardMode === "timed" ? (
              <OptionalNumberField
                // vazio vira 0: o schema recusa e o campo mostra a faixa
                value={rules.yellowOutMin || null}
                onChange={(value) => onChange("yellowOutMin", value ?? 0)}
                unit="min"
                hint={`De ${YELLOW_OUT_MIN} a ${YELLOW_OUT_MAX} minutos fora, menos que a Duração da partida.`}
                error={yellowOutError}
                isDisabled={isDisabled}
                accessibilityLabel="Minutos fora com o amarelo"
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
  },
  cardDisabled: { opacity: 0.45 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: theme.space[16],
  },
  headerTexts: { flex: 1, gap: 6 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[4],
    minHeight: theme.minTouch,
    marginTop: -10,
  },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  bold: { fontFamily: "Manrope-Bold" },
  body: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  field: { paddingVertical: 20 },
  divided: { borderTopWidth: 1, borderColor: theme.colors.divider },
  stack: { gap: 12 },
  raisedBox: {
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceRaised,
  },
  row: { flexDirection: "row", alignItems: "center", gap: theme.space[16] },
  rowTexts: { flex: 1, gap: theme.space[4] },
});
