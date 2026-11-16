import { ScrollView, StyleSheet, View } from "react-native";
import { Button, NoticeBanner, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PRO_BENEFITS_ACTIVE,
  PRO_BILLING_ACTION,
  PRO_BILLING_TEXT,
  PRO_BILLING_TITLE,
  PRO_MANAGE,
  PRO_YOUR_SUBSCRIPTION,
} from "../../utils/plan-messages";
import { PlanBenefits } from "./plan-benefits";
import { PlanLinks } from "./plan-links";

type TPlanStatusProps = {
  title: string;
  detail?: string;
  hasBillingIssue?: boolean;
  // false no iPhone (PLD2): sem ações da Google Play
  canManage: boolean;
  onManage: () => void;
  canRestore: boolean;
  isRestoring: boolean;
  onRestore: () => void;
};

export const PlanStatus = ({
  title,
  detail,
  hasBillingIssue = false,
  canManage,
  onManage,
  canRestore,
  isRestoring,
  onRestore,
}: TPlanStatusProps) => (
  <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statusArea}>
        <View style={styles.card}>
          <Text color="muted" style={styles.legend}>
            {PRO_YOUR_SUBSCRIPTION}
          </Text>
          <Text preset="h2">{title}</Text>
          {detail ? <Text color="muted">{detail}</Text> : null}
        </View>
        {hasBillingIssue ? (
          <NoticeBanner
            tone="warning"
            title={PRO_BILLING_TITLE}
            text={PRO_BILLING_TEXT}
            actionLabel={PRO_BILLING_ACTION}
            onAction={onManage}
          />
        ) : null}
      </View>

      <PlanBenefits title={PRO_BENEFITS_ACTIVE} />
    </ScrollView>

    {canManage ? (
      <ScreenFooter>
        <Button
          title={PRO_MANAGE}
          preset="outline"
          icon="external-link"
          onPress={onManage}
        />
        <PlanLinks
          onRestore={canRestore ? onRestore : undefined}
          isDisabled={isRestoring}
        />
      </ScreenFooter>
    ) : null}
  </>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: theme.space[24], paddingBottom: theme.space[16] },
  statusArea: { gap: 12 },
  card: {
    gap: theme.space[4],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  legend: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
});
