import { StyleSheet, View } from "react-native";
import { Button, Input, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  CONFIRM_EMAIL_CODE_HEADING,
  CONFIRM_EMAIL_CODE_HINT,
  CONFIRM_EMAIL_CODE_LABEL,
  CONFIRM_EMAIL_CODE_TEXT,
  CONFIRM_EMAIL_CONFIRM,
  CONFIRM_EMAIL_RESEND,
  CONFIRM_EMAIL_RESEND_INVALID,
  CONFIRM_EMAIL_RETRY,
  confirmEmailResendIn,
} from "../../utils/profile-messages";

type TProps = {
  email: string;
  code: string;
  codeError?: string;
  notice: string | null;
  hasInvalidCode: boolean;
  hasSendFailed: boolean;
  hasConfirmFailed: boolean;
  cooldownLabel: string | null;
  isSending: boolean;
  isVerifying: boolean;
  onChangeCode: (text: string) => void;
  onConfirm: () => void;
  onResend: () => void;
};

export const ConfirmEmailCode = ({
  email,
  code,
  codeError,
  notice,
  hasInvalidCode,
  hasSendFailed,
  hasConfirmFailed,
  cooldownLabel,
  isSending,
  isVerifying,
  onChangeCode,
  onConfirm,
  onResend,
}: TProps) => {
  const resendTitle = hasSendFailed
    ? CONFIRM_EMAIL_RETRY
    : hasInvalidCode
      ? CONFIRM_EMAIL_RESEND_INVALID
      : CONFIRM_EMAIL_RESEND;

  return (
    <>
      <View style={styles.content}>
        <Text preset="h2">{CONFIRM_EMAIL_CODE_HEADING}</Text>
        <Text color="muted">
          {CONFIRM_EMAIL_CODE_TEXT} <Text style={styles.email}>{email}</Text>
        </Text>
        <Input
          label={CONFIRM_EMAIL_CODE_LABEL}
          hint={CONFIRM_EMAIL_CODE_HINT}
          error={codeError}
          value={code}
          onChangeText={onChangeCode}
          placeholder="000000"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          isDisabled={isVerifying}
          style={styles.code}
        />
        {cooldownLabel ? (
          <Text color="textDisabled" style={styles.resendIn}>
            {confirmEmailResendIn(cooldownLabel)}
          </Text>
        ) : (
          <Button
            title={resendTitle}
            preset="text"
            isLoading={isSending}
            onPress={onResend}
          />
        )}
      </View>

      <ScreenFooter>
        {notice ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        <Button
          title={hasConfirmFailed ? CONFIRM_EMAIL_RETRY : CONFIRM_EMAIL_CONFIRM}
          isDisabled={code.length < 6}
          isLoading={isVerifying}
          onPress={onConfirm}
        />
      </ScreenFooter>
    </>
  );
};

const styles = StyleSheet.create({
  content: { gap: theme.space[16], paddingTop: theme.space[8] },
  email: { fontFamily: "Manrope-Bold" },
  code: {
    minHeight: 64,
    textAlign: "center",
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 12,
  },
  resendIn: { textAlign: "center" },
});
