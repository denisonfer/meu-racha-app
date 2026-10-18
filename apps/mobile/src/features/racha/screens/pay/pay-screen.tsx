import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Icon,
  NoticeBanner,
  PixQrCode,
  Screen,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PAY,
  PAY_COPY,
  PAY_COPY_HINT,
  PAY_COVERED_CREDIT,
  PAY_DUE,
  PAY_ERROR_TEXT,
  PAY_ERROR_TITLE,
  PAY_NO_KEY_TEXT,
  PAY_NO_KEY_TITLE,
  PAY_PAID_TEXT,
  PAY_PAID_TITLE,
  PAY_QR_FAILED_TEXT,
  PAY_QR_FAILED_TITLE,
  PAY_REMINDER,
  PAY_WAITLIST_TEXT,
  PAY_WAITLIST_TITLE,
  payCoveredCreditText,
} from "../../utils/racha-messages";
import { PaymentBreakdown } from "./payment-breakdown";
import { usePayScreen } from "./use-pay-screen";

type TStatusCardProps = { title: string; text: string; isSuccess?: boolean };

const StatusCard = ({ title, text, isSuccess = false }: TStatusCardProps) => (
  <View style={styles.statusCard}>
    {isSuccess ? <Icon name="success" size={40} color="success" /> : null}
    <Text preset={isSuccess ? "h2" : "body"} style={styles.bold}>
      {title}
    </Text>
    <Text preset="small" color="muted" style={styles.center}>
      {text}
    </Text>
  </View>
);

export const PayScreen = () => {
  const {
    isLoading,
    isError,
    retry,
    isRetrying,
    context,
    kind,
    isWaitlisted,
    amountText,
    creditLeft,
    rows,
    recipient,
    keyLine,
    brCode,
    isQrFailed,
    onQrError,
    copy,
  } = usePayScreen();

  return (
    <Screen title={PAY} canGoBack isScrollable>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel="Carregando pagamento"
        />
      ) : isError || !kind ? (
        <EmptyState
          title={PAY_ERROR_TITLE}
          text={PAY_ERROR_TEXT}
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <View style={styles.content}>
          <Text
            preset="small"
            color="muted"
            style={[styles.bold, styles.center]}
          >
            {context}
          </Text>

          {kind === "paid" ? (
            <StatusCard title={PAY_PAID_TITLE} text={PAY_PAID_TEXT} isSuccess />
          ) : (
            <>
              {isWaitlisted ? (
                <NoticeBanner
                  tone="warning"
                  title={PAY_WAITLIST_TITLE}
                  text={PAY_WAITLIST_TEXT}
                />
              ) : null}

              {kind === "coveredByCredit" ? (
                <StatusCard
                  title={PAY_COVERED_CREDIT}
                  text={payCoveredCreditText(creditLeft)}
                  isSuccess
                />
              ) : (
                <View style={styles.amountBox}>
                  <Text preset="small" color="muted" style={styles.bold}>
                    {PAY_DUE}
                  </Text>
                  <Text
                    preset="score"
                    color="action"
                    style={styles.amount}
                    accessibilityLabel={amountText}
                  >
                    {amountText}
                  </Text>
                  <Text>{recipient}</Text>
                  {keyLine ? (
                    <Text preset="small" color="muted" style={styles.bold}>
                      {keyLine}
                    </Text>
                  ) : null}
                </View>
              )}

              {rows.length > 1 ? <PaymentBreakdown rows={rows} /> : null}

              {kind === "noKey" ? (
                <StatusCard title={PAY_NO_KEY_TITLE} text={PAY_NO_KEY_TEXT} />
              ) : null}

              {brCode ? (
                <>
                  {isQrFailed ? (
                    <View style={styles.qrFailed}>
                      <Text style={styles.bold}>{PAY_QR_FAILED_TITLE}</Text>
                      <Text preset="small" color="muted" style={styles.center}>
                        {PAY_QR_FAILED_TEXT}
                      </Text>
                    </View>
                  ) : (
                    <PixQrCode value={brCode} onError={onQrError} />
                  )}
                  <View style={styles.copyBox}>
                    <Button
                      title={PAY_COPY}
                      icon="copy"
                      onPress={copy}
                      accessibilityLabel={PAY_COPY}
                    />
                    <Text preset="small" color="muted" style={styles.center}>
                      {PAY_COPY_HINT}
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          )}

          <View style={styles.divider} />
          <Text preset="small" color="muted" style={styles.center}>
            {PAY_REMINDER}
          </Text>
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingBottom: theme.space[24],
  },
  bold: { fontFamily: "Manrope-Bold" },
  center: { textAlign: "center" },
  amountBox: { alignItems: "center", gap: 4 },
  amount: { fontVariant: ["tabular-nums"] },
  statusCard: {
    alignItems: "center",
    gap: 8,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  qrFailed: {
    alignItems: "center",
    gap: 4,
    padding: theme.space[24],
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.mutedDisabled,
  },
  copyBox: { gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
});
