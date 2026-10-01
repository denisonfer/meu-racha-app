import { Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RoleChip } from "../../components/role-chip";
import { TMemberRole } from "../../racha-types";

type TRachaCardProps = {
  name: string;
  role: TMemberRole;
  membersLabel: string;
  pendingLabel: string | null;
  accessibilityLabel: string;
  canCreateEvent: boolean;
  onPress: () => void;
};

// Só a variante sem Evento: a do próximo Evento chega com a fatia 5
export const RachaCard = ({
  name,
  role,
  membersLabel,
  pendingLabel,
  accessibilityLabel,
  canCreateEvent,
  onPress,
}: TRachaCardProps) => (
  <View style={styles.card}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
    >
      <View style={[styles.grow, styles.cardTexts]}>
        {pendingLabel ? (
          <View style={styles.badge}>
            <Icon name="user-plus" size={16} color="onAction" />
            <Text style={styles.badgeLabel}>{pendingLabel}</Text>
          </View>
        ) : null}
        <Text preset="h3">{name}</Text>
        <View style={styles.roleRow}>
          <RoleChip role={role} />
          <Text preset="small" color="muted">
            {membersLabel}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" color="muted" />
    </Pressable>

    <View style={styles.cardBottom}>
      <View style={styles.cardNoEvent}>
        <Text style={styles.bold}>Nenhum evento marcado</Text>
        <Text preset="small" color="muted">
          {canCreateEvent
            ? "Marque o próximo jogo para a galera confirmar presença."
            : "Quando o dono marcar o próximo jogo, ele aparece aqui."}
        </Text>
      </View>
      {/* sem destino: criar evento é a fatia 5 */}
      {canCreateEvent ? (
        <Button title="Criar primeiro evento" onPress={() => {}} />
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  pressed: { opacity: 0.8 },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingTop: theme.space[16],
    paddingBottom: 14,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  cardTexts: { gap: 8, alignItems: "flex-start" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingLeft: theme.space[8],
    paddingRight: 10,
    borderRadius: theme.radius.check,
    backgroundColor: theme.colors.action,
  },
  badgeLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: theme.colors.onAction,
  },
  roleRow: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  cardBottom: {
    gap: 12,
    marginHorizontal: theme.space[16],
    paddingTop: 14,
    paddingBottom: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  cardNoEvent: { gap: 2 },
});
