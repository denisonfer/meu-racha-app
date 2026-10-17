import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Input,
  OptionList,
  Screen,
  ScreenFooter,
  Text,
  type TOptionListOption,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import type { TReportReason } from "../../moderation-types";
import {
  REPORT_DETAILS,
  REPORT_DETAILS_PLACEHOLDER,
  REPORT_DETAILS_SUFFIX,
  REPORT_REASON,
  REPORT_SEND,
  REPORT_SENDING,
} from "../../utils/moderation-messages";

export type TReportFormProps = {
  title: string;
  text: string;
  options: TOptionListOption<TReportReason>[];
  reason: TReportReason | "";
  onReasonChange: (value: TReportReason | "") => void;
  details: string;
  onDetailsChange: (value: string) => void;
  isSending: boolean;
  failureMessage: string | null;
  onSend: () => void;
};

export const ReportForm = ({
  title,
  text,
  options,
  reason,
  onReasonChange,
  details,
  onDetailsChange,
  isSending,
  failureMessage,
  onSend,
}: TReportFormProps) => (
  <Screen title={title} canGoBack>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Text>{text}</Text>
      <View style={styles.reasons}>
        <Text style={styles.groupTitle}>{REPORT_REASON}</Text>
        {/* "" fora das opções: nada marcado até a pessoa escolher */}
        <OptionList<TReportReason | "">
          options={options}
          value={reason}
          onChange={onReasonChange}
          isDisabled={isSending}
        />
      </View>
      <Input
        label={REPORT_DETAILS}
        labelSuffix={REPORT_DETAILS_SUFFIX}
        placeholder={REPORT_DETAILS_PLACEHOLDER}
        value={details}
        onChangeText={onDetailsChange}
        multiline
        maxLength={500}
        isDisabled={isSending}
        style={styles.details}
      />
    </ScrollView>
    <ScreenFooter>
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button
        title={REPORT_SEND}
        onPress={onSend}
        isDisabled={!reason}
        isLoading={isSending}
        accessibilityLabel={isSending ? REPORT_SENDING : REPORT_SEND}
        style={styles.send}
      />
    </ScreenFooter>
  </Screen>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 20, paddingBottom: theme.space[24] },
  reasons: { gap: theme.space[8] },
  groupTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
  },
  details: {
    height: 76,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  send: { minHeight: 56 },
});
