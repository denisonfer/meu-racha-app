import { initialsOf } from "@meu-racha/domain";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, PlayerCardMini, Text, type TIconName } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SORT_INCOMPLETE } from "../utils/racha-messages";

export type TSortRowAction = {
  label: string;
  /** Quando existe, a ação aparece só como ícone; o rótulo vira só acessibilidade. */
  icon?: TIconName;
  accessibilityLabel: string;
  onPress: () => void;
  isDisabled: boolean;
};

export type TSortTeamCardPerson = {
  key: string;
  name: string;
  photoUrl: string | null;
  overall: number;
  // vazio para o Goleiro
  detail: string;
  // Bolinhas: quem acabou de chegar ao Time fica em destaque
  isHighlighted?: boolean;
  stars: number | null;
  isSuperStar: boolean;
  isGoalkeeper: boolean;
  accessibilityLabel: string;
  action: TSortRowAction | null;
};

export type TSortTeamCardProps = {
  title: string;
  starSum: number;
  // “1/5” só no Time incompleto
  occupancyText: string | null;
  isIncomplete: boolean;
  missingText: string | null;
  headerAccessibilityLabel: string;
  players: TSortTeamCardPerson[];
  // Evento 8+: os jogadores de linha por subdivisão, com cabeçalho; null mostra `players` sem grupos
  playerGroups:
    | {
        key: string;
        title: string;
        players: TSortTeamCardPerson[];
      }[]
    | null;
  goalkeeper: TSortTeamCardPerson | null;
};

const PersonRow = ({ person }: { person: TSortTeamCardPerson }) => (
  <View style={[styles.person, person.isHighlighted && styles.highlighted]}>
    <View
      accessible
      accessibilityLabel={person.accessibilityLabel}
      style={styles.identity}
    >
      <PlayerCardMini
        width={44}
        overall={person.overall}
        initials={initialsOf(person.name)}
        photoUri={person.photoUrl}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          {person.isSuperStar ? (
            <View style={styles.superChip}>
              <Text style={styles.superChipLabel}>SUPER</Text>
            </View>
          ) : null}
        </View>
        {person.detail ? (
          <Text
            preset="caption"
            color={person.isHighlighted ? "action" : "muted"}
            style={styles.detail}
          >
            {person.detail}
          </Text>
        ) : null}
      </View>
      {person.isGoalkeeper ? (
        <Text style={styles.gol}>GOL</Text>
      ) : person.stars !== null ? (
        <View style={styles.stars}>
          <Text style={styles.starsNumber}>{person.stars}</Text>
          <Icon name="star" size={16} color="action" fill="action" />
        </View>
      ) : null}
    </View>
    {person.action ? (
      <Pressable
        onPress={person.action.onPress}
        disabled={person.action.isDisabled}
        accessibilityRole="button"
        accessibilityLabel={person.action.accessibilityLabel}
        accessibilityState={{ disabled: person.action.isDisabled }}
        style={[styles.action, person.action.isDisabled && styles.busy]}
      >
        {person.action.icon ? (
          <Icon name={person.action.icon} size={22} color="errorText" />
        ) : (
          <Text preset="small" color="action" style={styles.actionLabel}>
            {person.action.label}
          </Text>
        )}
      </Pressable>
    ) : null}
  </View>
);

/**
 * Cartão de Time da proposta e dos Times publicados: o mesmo para o Condutor
 * e para quem só olha. O incompleto tem fundo e borda tracejada próprios, e
 * também o rótulo e a contagem, para não depender só da cor.
 */
export const SortTeamCard = ({
  title,
  starSum,
  occupancyText,
  isIncomplete,
  missingText,
  headerAccessibilityLabel,
  players,
  playerGroups,
  goalkeeper,
}: TSortTeamCardProps) => (
  <View style={[styles.card, isIncomplete && styles.incomplete]}>
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={headerAccessibilityLabel}
      style={[styles.head, isIncomplete && styles.headIncomplete]}
    >
      <View>
        <Text preset="h3">{title}</Text>
        {isIncomplete ? (
          <Text preset="caption" color="warning" style={styles.incompleteLabel}>
            {SORT_INCOMPLETE}
          </Text>
        ) : null}
      </View>
      <View style={styles.headEnd}>
        {occupancyText ? (
          <View style={styles.occupancy}>
            <Text preset="small" color="warning" style={styles.bold}>
              {occupancyText}
            </Text>
          </View>
        ) : null}
        <View style={styles.sum}>
          <Text style={styles.sumNumber}>{starSum}</Text>
          <Icon name="star" size={16} color="action" fill="action" />
        </View>
      </View>
    </View>
    <View style={styles.list}>
      {goalkeeper ? <PersonRow person={goalkeeper} /> : null}
      {playerGroups
        ? playerGroups.map((group) => (
            <View key={group.key}>
              <Text preset="small" color="muted" style={styles.groupTitle}>
                {group.title}
              </Text>
              {group.players.map((person) => (
                <PersonRow key={person.key} person={person} />
              ))}
            </View>
          ))
        : players.map((person) => (
            <PersonRow key={person.key} person={person} />
          ))}
    </View>
    {missingText ? (
      <Text preset="small" color="warning" style={styles.missing}>
        {missingText}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  // borda tracejada de 1 px em cor de aviso: o sinal de Time incompleto
  incomplete: {
    backgroundColor: theme.colors.warningSurface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.warning,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  headIncomplete: { borderStyle: "dashed", borderColor: theme.colors.warning },
  headEnd: { flexDirection: "row", alignItems: "center", gap: 10 },
  incompleteLabel: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
  occupancy: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
  },
  bold: { fontFamily: "Manrope-Bold" },
  sum: { flexDirection: "row", alignItems: "center", gap: 3 },
  sumNumber: {
    ...theme.text.stat,
    color: theme.colors.action,
    fontVariant: ["tabular-nums"],
  },
  list: { paddingTop: 6 },
  // mesmo cabeçalho de grupo da Presença
  groupTitle: { paddingTop: 8, paddingBottom: 2, fontFamily: "Manrope-Bold" },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingVertical: 4,
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  detail: { fontFamily: "Manrope-Bold" },
  highlighted: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.control,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  stars: { flexDirection: "row", alignItems: "center", gap: 3 },
  starsNumber: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    color: theme.colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  gol: {
    ...theme.text.stat,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 0.8,
    color: theme.colors.foreground,
  },
  superChip: {
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: theme.radius.check,
    borderWidth: 1,
    borderColor: theme.colors.action,
  },
  superChipLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: theme.colors.action,
  },
  action: {
    minHeight: theme.minTouch,
    minWidth: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionLabel: { fontFamily: "Manrope-Bold" },
  busy: { opacity: 0.5 },
  missing: { marginTop: 10, fontFamily: "Manrope-Bold" },
});
