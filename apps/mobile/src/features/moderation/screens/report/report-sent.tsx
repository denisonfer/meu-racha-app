import { StyleSheet, View } from "react-native";
import { BottomSheet, Button, Icon, Text } from "@/ui/components";
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
  <BottomSheet
    title={REPORT_SENT}
    leading={<Icon name="success" size={32} color="success" />}
    supporting={<Text>{text}</Text>}
  >
    {blockAsk ? (
      <View style={styles.blockCard}>
        <Text>{blockAsk}</Text>
        <Button title={blockAction} preset="secondary" onPress={onBlock} />
      </View>
    ) : null}
    <Button
      title={CLOSE}
      preset="outline"
      onPress={onClose}
      style={styles.close}
    />
  </BottomSheet>
);

const styles = StyleSheet.create({
  blockCard: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  close: { minHeight: 48 },
});
