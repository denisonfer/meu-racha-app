import { StyleSheet, View } from "react-native";
import { Button, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  CONFIRM_EMAIL_RETRY,
  CONFIRM_EMAIL_SEND,
  CONFIRM_EMAIL_SEND_HEADING,
  CONFIRM_EMAIL_SEND_TEXT,
} from "../../utils/profile-messages";

type TProps = {
  email: string;
  notice: string | null;
  hasSendFailed: boolean;
  isSending: boolean;
  onSend: () => void;
};

export const ConfirmEmailSend = ({
  email,
  notice,
  hasSendFailed,
  isSending,
  onSend,
}: TProps) => (
  <>
    <View style={styles.content}>
      <Text preset="h2">{CONFIRM_EMAIL_SEND_HEADING}</Text>
      <Text color="muted">
        {CONFIRM_EMAIL_SEND_TEXT} <Text style={styles.email}>{email}</Text>
      </Text>
    </View>

    <ScreenFooter>
      {notice ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}
      <Button
        title={hasSendFailed ? CONFIRM_EMAIL_RETRY : CONFIRM_EMAIL_SEND}
        isLoading={isSending}
        onPress={onSend}
      />
    </ScreenFooter>
  </>
);

const styles = StyleSheet.create({
  content: { gap: theme.space[16], paddingTop: theme.space[8] },
  email: { fontFamily: "Manrope-Bold" },
});
