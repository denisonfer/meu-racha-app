import { StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TJoinRequestCardProps = {
  rachaName: string;
  isCancelling: boolean;
  // true enquanto outro pedido está cancelando: nunca há dois em voo
  isCancelDisabled: boolean;
  onCancel: () => void;
};

export const JoinRequestCard = ({
  rachaName,
  isCancelling,
  isCancelDisabled,
  onCancel,
}: TJoinRequestCardProps) => (
  <View style={styles.card}>
    <View
      accessible
      accessibilityLabel={`Pedido para ${rachaName}, aguardando aprovação`}
      style={styles.texts}
    >
      <View style={styles.header}>
        <Text preset="h3">{rachaName}</Text>
        <View style={styles.badge}>
          <Icon name="clock" size={16} />
          <Text style={styles.badgeLabel}>AGUARDANDO APROVAÇÃO</Text>
        </View>
      </View>
      <Text preset="small" color="muted">
        Seu pedido foi enviado. Você entra quando o dono ou um admin aprovar.
      </Text>
    </View>
    <Button
      title="Cancelar pedido"
      preset="secondary"
      accessibilityLabel={isCancelling ? "Cancelando" : "Cancelar pedido"}
      isLoading={isCancelling}
      isDisabled={isCancelDisabled}
      onPress={onCancel}
      style={styles.cancelButton}
    />
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.muted,
  },
  texts: { gap: 12 },
  header: {
    gap: theme.space[8],
    alignItems: "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: theme.space[8],
    borderRadius: theme.radius.check,
    backgroundColor: theme.colors.surface,
  },
  badgeLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  cancelButton: { alignSelf: "flex-start" },
});
