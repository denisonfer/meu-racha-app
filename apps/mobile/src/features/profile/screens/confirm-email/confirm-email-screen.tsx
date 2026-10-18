import { Screen } from "@/ui/components";
import { CONFIRM_EMAIL_TITLE } from "../../utils/profile-messages";
import { ConfirmEmailCode } from "./confirm-email-code";
import { ConfirmEmailSend } from "./confirm-email-send";
import { useConfirmEmailScreen } from "./use-confirm-email-screen";

export const ConfirmEmailScreen = () => {
  const s = useConfirmEmailScreen();

  return (
    <Screen canGoBack title={CONFIRM_EMAIL_TITLE}>
      {s.phase === "send" ? (
        <ConfirmEmailSend
          email={s.email}
          notice={s.notice}
          hasSendFailed={s.hasSendFailed}
          isSending={s.isSending}
          onSend={s.send}
        />
      ) : (
        <ConfirmEmailCode
          email={s.email}
          code={s.code}
          codeError={s.codeError}
          notice={s.notice}
          hasInvalidCode={s.hasInvalidCode}
          hasSendFailed={s.hasSendFailed}
          hasConfirmFailed={s.hasConfirmFailed}
          cooldownLabel={s.cooldownLabel}
          isSending={s.isSending}
          isVerifying={s.isVerifying}
          onChangeCode={s.changeCode}
          onConfirm={s.confirm}
          onResend={s.send}
        />
      )}
    </Screen>
  );
};
