import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TeamQueueOption } from "../../components/team-queue-option";
import { BOLINHAS_CHANGE } from "../../utils/racha-messages";
import type { TBolinhasRow } from "./use-bolinhas-screen";

type TProps = {
  title: string;
  rows: TBolinhasRow[];
  isMuted?: boolean;
  helper?: string;
  onChange?: () => void;
};

export const BolinhasTeamList = ({
  title,
  rows,
  isMuted = false,
  helper,
  onChange,
}: TProps) => (
  <View style={styles.block}>
    <View style={styles.head}>
      <Text
        preset="h3"
        accessibilityRole="header"
        style={isMuted ? { color: theme.colors.textDisabled } : undefined}
      >
        {title}
      </Text>
      {onChange ? (
        <Button title={BOLINHAS_CHANGE} preset="text" onPress={onChange} />
      ) : null}
    </View>
    {helper ? (
      <Text preset="small" color="muted">
        {helper}
      </Text>
    ) : null}
    {rows.length > 0 ? (
      <View accessibilityRole="radiogroup" style={styles.rows}>
        {rows.map(({ key, ...row }) => (
          <TeamQueueOption key={key} {...row} />
        ))}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  block: { gap: 8 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rows: { gap: 8 },
});
