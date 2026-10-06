import { StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  BOLINHAS_BACK_TO_TEAMS,
  BOLINHAS_NO_GIVER_TEXT,
  BOLINHAS_NO_GIVER_TITLE,
  BOLINHAS_NO_RECEIVER_TEXT,
  BOLINHAS_NO_RECEIVER_TITLE,
} from "../../utils/racha-messages";

type TProps = { reason: "no_receiver" | "no_giver"; onBack: () => void };

/** M4: a tela abriu e a situação mudou (outro aparelho incluiu alguém, a Partida começou). */
export const BolinhasUnavailable = ({ reason, onBack }: TProps) => (
  <View style={styles.box}>
    <View style={styles.icon}>
      <Icon name="bolinhas" size={36} color="muted" strokeWidth={1.8} />
    </View>
    <Text preset="h2" style={styles.center}>
      {reason === "no_receiver"
        ? BOLINHAS_NO_RECEIVER_TITLE
        : BOLINHAS_NO_GIVER_TITLE}
    </Text>
    <Text color="muted" style={styles.center}>
      {reason === "no_receiver"
        ? BOLINHAS_NO_RECEIVER_TEXT
        : BOLINHAS_NO_GIVER_TEXT}
    </Text>
    <Button
      title={BOLINHAS_BACK_TO_TEAMS}
      preset="outline"
      onPress={onBack}
      style={styles.button}
    />
  </View>
);

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  button: { marginTop: 8, minWidth: 200 },
});
