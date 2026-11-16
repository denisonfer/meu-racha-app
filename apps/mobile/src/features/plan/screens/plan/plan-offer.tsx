import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Icon,
  NoticeBanner,
  OptionList,
  ScreenFooter,
  Text,
  type TOptionListOption,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PRO_ACTIVATING,
  PRO_ACTIVATING_TEXT,
  PRO_BENEFITS_OFFER,
  PRO_BUYING,
  PRO_DECLINED,
  PRO_HERO,
  PRO_HERO_TEXT,
  PRO_IOS_UNAVAILABLE,
  PRO_LOADING,
  PRO_PLAN,
  PRO_RETRY,
  PRO_SLOW,
  PRO_SLOW_TEXT,
  PRO_UNAVAILABLE,
} from "../../utils/plan-messages";
import { PlanBenefits } from "./plan-benefits";
import { PlanLinks } from "./plan-links";
import type { TOfferPhase, TPlanChoice } from "./use-plan-screen";

type TPlanOfferProps = {
  // false: produção com a venda fechada ou iPhone (PLD1), sem preço nem compra
  isAvailable: boolean;
  isIos: boolean;
  phase: TOfferPhase;
  options: TOptionListOption<TPlanChoice>[];
  selected: TPlanChoice;
  onSelect: (plan: TPlanChoice) => void;
  ctaTitle: string;
  renewal: string;
  isBuying: boolean;
  isDeclined: boolean;
  onBuy: () => void;
  onRetryLoad: () => void;
  onRetryActivation: () => void;
  isRestoring: boolean;
  onRestore: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
};

export const PlanOffer = ({
  isAvailable,
  isIos,
  phase,
  options,
  selected,
  onSelect,
  ctaTitle,
  renewal,
  isBuying,
  isDeclined,
  onBuy,
  onRetryLoad,
  onRetryActivation,
  isRestoring,
  onRestore,
  onTerms,
  onPrivacy,
}: TPlanOfferProps) => (
  <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text preset="h2">{PRO_HERO}</Text>
        <Text color="muted">{PRO_HERO_TEXT}</Text>
      </View>

      <PlanBenefits title={PRO_BENEFITS_OFFER} isAllSoon={!isAvailable} />

      {!isAvailable ? (
        isIos ? (
          <View style={styles.infoCard}>
            <Icon name="info" color="muted" />
            <Text style={styles.grow}>{PRO_IOS_UNAVAILABLE}</Text>
          </View>
        ) : null
      ) : phase === "activating" ? (
        <View style={styles.activating} accessibilityRole="summary">
          <ActivityIndicator color={theme.colors.action} />
          <View style={styles.grow} accessibilityLiveRegion="polite">
            <Text style={styles.bold}>{PRO_ACTIVATING}</Text>
            <Text preset="small" color="muted">
              {PRO_ACTIVATING_TEXT}
            </Text>
          </View>
        </View>
      ) : phase === "slow" ? (
        <NoticeBanner
          tone="warning"
          title={PRO_SLOW}
          text={PRO_SLOW_TEXT}
          isAlert
        />
      ) : phase === "unavailable" ? (
        <View style={styles.errorCard} accessibilityRole="alert">
          <Icon name="error" color="danger" />
          <Text style={[styles.grow, styles.bold]}>{PRO_UNAVAILABLE}</Text>
        </View>
      ) : (
        <View style={styles.plans}>
          <Text color="muted" style={styles.legend}>
            {PRO_PLAN}
          </Text>
          {phase === "loading" ? (
            <View
              style={styles.plans}
              accessibilityRole="progressbar"
              accessibilityLabel={PRO_LOADING}
            >
              <View style={styles.placeholder} />
              <View style={styles.placeholder} />
            </View>
          ) : (
            <OptionList
              options={options}
              value={selected}
              onChange={onSelect}
              isDisabled={isBuying}
            />
          )}
        </View>
      )}
    </ScrollView>

    {isAvailable ? (
      <ScreenFooter>
        {phase === "ready" && isDeclined ? (
          <Text
            preset="small"
            color="errorText"
            style={styles.bold}
            accessibilityRole="alert"
          >
            {PRO_DECLINED}
          </Text>
        ) : null}
        {phase === "unavailable" ? (
          <Button title={PRO_RETRY} onPress={onRetryLoad} />
        ) : phase === "slow" ? (
          <Button title={PRO_RETRY} onPress={onRetryActivation} />
        ) : phase === "ready" || phase === "loading" ? (
          <Button
            title={ctaTitle}
            onPress={onBuy}
            isDisabled={phase === "loading" || isBuying}
            isLoading={phase === "loading" || isBuying}
            accessibilityLabel={isBuying ? PRO_BUYING : ctaTitle}
          />
        ) : null}
        {phase === "ready" ? (
          <Text preset="small" color="muted" style={styles.center}>
            {renewal}
          </Text>
        ) : null}
        <PlanLinks
          onRestore={onRestore}
          onTerms={onTerms}
          onPrivacy={onPrivacy}
          isDisabled={isBuying || isRestoring}
        />
      </ScreenFooter>
    ) : null}
  </>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: theme.space[24], paddingBottom: theme.space[16] },
  hero: { gap: theme.space[8] },
  legend: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
  plans: { gap: theme.space[8] },
  placeholder: {
    height: 76,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  activating: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  grow: { flex: 1 },
  bold: { fontFamily: "Manrope-Bold" },
  center: { textAlign: "center" },
});
