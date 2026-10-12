import { StyleSheet, View } from "react-native";
import { Avatar, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { UNBLOCK } from "../../utils/settings-messages";

export type TBlockedPersonRowProps = {
  name: string;
  photoUrl: string | null;
  rachaLine: string;
  onUnblock: () => void;
};

// Avatar e não a carta mini: o Overall é por Racha e esta lista cruza Rachas.
export const BlockedPersonRow = ({
  name,
  photoUrl,
  rachaLine,
  onUnblock,
}: TBlockedPersonRowProps) => (
  <View style={styles.row}>
    <Avatar name={name} photoUrl={photoUrl} size={44} />
    <View style={styles.texts}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text preset="small" color="muted" numberOfLines={1}>
        {rachaLine}
      </Text>
    </View>
    <Button
      title={UNBLOCK}
      preset="outline"
      onPress={onUnblock}
      accessibilityLabel={`${UNBLOCK} ${name}`}
      style={styles.unblock}
    />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: theme.space[16],
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: "Manrope-Bold", fontSize: 16, lineHeight: 22 },
  unblock: { paddingVertical: 8, paddingHorizontal: 16 },
});
