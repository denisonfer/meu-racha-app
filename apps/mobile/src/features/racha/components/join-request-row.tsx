import { StyleSheet, View } from "react-native";
import { Avatar, Button, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TJoinRequestRowProps = {
  name: string;
  photoUrl: string | null;
  ageText: string;
  isBelowMinAge: boolean;
  playsAsText: string;
  accessibilityLabel: string;
  isRefusing: boolean;
  isDisabled: boolean;
  onRefuse: () => void;
  onApprove: () => void;
};

export const JoinRequestRow = ({
  name,
  photoUrl,
  ageText,
  isBelowMinAge,
  playsAsText,
  accessibilityLabel,
  isRefusing,
  isDisabled,
  onRefuse,
  onApprove,
}: TJoinRequestRowProps) => (
  <View style={styles.card}>
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={styles.person}
    >
      <Avatar name={name} photoUrl={photoUrl} size={48} />
      <View style={styles.texts}>
        <Text preset="h3">{name}</Text>
        {isBelowMinAge ? (
          <View style={styles.warningRow}>
            <View style={styles.warningIcon}>
              <Icon name="alert" size={16} color="warning" />
            </View>
            <Text preset="small" color="warning" style={styles.bold}>
              {ageText}
            </Text>
          </View>
        ) : (
          <Text preset="small" color="muted">
            {ageText}
          </Text>
        )}
        <Text preset="small" style={styles.bold}>
          {playsAsText}
        </Text>
      </View>
    </View>

    <View style={styles.actions}>
      <Button
        title="Recusar"
        preset="outline"
        isLoading={isRefusing}
        isDisabled={isDisabled && !isRefusing}
        accessibilityLabel={isRefusing ? "Recusando" : "Recusar"}
        onPress={onRefuse}
        style={styles.action}
      />
      <Button
        title="Aprovar"
        preset="secondary"
        isDisabled={isDisabled}
        onPress={onApprove}
        style={styles.action}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  person: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  texts: { flex: 1, gap: 2 },
  warningRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  warningIcon: { marginTop: 2 },
  bold: { fontFamily: "Manrope-Bold" },
  actions: { flexDirection: "row", gap: theme.space[8] },
  action: { flex: 1, paddingHorizontal: theme.space[8] },
});
