import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { PRO_BENEFITS, PRO_SCOPE, PRO_SOON } from "../../utils/plan-messages";

type TPlanBenefitsProps = {
  title: string;
  // sem compra disponível, nada do Pro está ao alcance: tudo vai "Em breve"
  isAllSoon?: boolean;
};

export const PlanBenefits = ({
  title,
  isAllSoon = false,
}: TPlanBenefitsProps) => (
  <View style={styles.section}>
    <Text color="muted" style={styles.legend}>
      {title}
    </Text>
    <View style={styles.card}>
      {PRO_BENEFITS.map((benefit, index) => {
        const isSoon = isAllSoon || benefit.isSoon;
        return (
          <Fragment key={benefit.title}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`${benefit.title}${isSoon ? `, ${PRO_SOON}` : ""}. ${benefit.text}`}
            >
              <Icon name={benefit.icon} size={24} />
              <View style={styles.texts}>
                <View style={styles.titleLine}>
                  <Text style={styles.title}>{benefit.title}</Text>
                  {isSoon ? (
                    <Text color="muted" style={styles.chip}>
                      {PRO_SOON}
                    </Text>
                  ) : null}
                </View>
                <Text preset="small" color="muted">
                  {benefit.text}
                </Text>
              </View>
            </View>
          </Fragment>
        );
      })}
    </View>
    <View style={styles.scope}>
      <Icon name="info" size={18} color="muted" />
      <Text preset="small" color="muted" style={styles.grow}>
        {PRO_SCOPE}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  section: { gap: theme.space[8] },
  legend: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: theme.space[16],
  },
  texts: { flex: 1, gap: 2 },
  titleLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.space[8],
  },
  title: { fontFamily: "Manrope-Bold" },
  chip: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.check,
  },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  scope: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  grow: { flex: 1 },
});
