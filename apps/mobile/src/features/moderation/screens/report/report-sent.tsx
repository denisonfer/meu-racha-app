import { StyleSheet, View } from "react-native";
import { Button, Icon, Screen, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { CLOSE, REPORT_SENT } from "../../utils/moderation-messages";

export type TReportSentProps = {
  text: string;
  /** Sem a pergunta (Racha ou pessoa já bloqueada), não oferece bloquear. */
  blockAsk: string | null;
  blockAction: string;
  onBlock: () => void;
  onClose: () => void;
};

export const ReportSent = ({
  text,
  blockAsk,
  blockAction,
  onBlock,
  onClose,
}: TReportSentProps) => (
  <Screen title={REPORT_SENT} canGoBack>
    <View style={styles.content}>
      <Icon name="success" size={32} color="success" />
      <Text>{text}</Text>
      {blockAsk ? (
        <View style={styles.blockCard}>
          <Text>{blockAsk}</Text>
          <Button title={blockAction} preset="secondary" onPress={onBlock} />
        </View>
      ) : null}
    </View>
    <ScreenFooter>
      <Button
        title={CLOSE}
        preset="outline"
        onPress={onClose}
        style={styles.close}
      />
    </ScreenFooter>
  </Screen>
);

const styles = StyleSheet.create({
  content: { flex: 1, gap: theme.space[16] },
  blockCard: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  close: { minHeight: 48 },
});
