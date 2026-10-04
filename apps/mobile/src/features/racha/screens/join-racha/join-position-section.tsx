import type { TPositionDetail } from "@meu-racha/domain";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { PositionDetailField } from "../../components/position-detail-field";
import type { TPositionDetailSlot } from "../../utils/position-detail-view";
import type { TPositionSlot } from "../../utils/racha-labels";
import {
  POSITION_DETAIL_JOIN_TEXT,
  POSITION_DETAIL_LOAD_FAILED,
  POSITION_DETAIL_PROFILE_HINT,
  positionDetailJoinKicker,
} from "../../utils/racha-messages";

export type TJoinPositionRow = TPositionDetailSlot & {
  // "Posição principal" e "Defensor": a zona do Perfil, só leitura
  zoneTitle: string;
  zoneName: string;
  fieldLabel: string;
};

type TJoinPositionSectionProps = {
  outfieldPerTeam: number;
  rows: TJoinPositionRow[];
  values: Record<TPositionSlot, TPositionDetail | null>;
  errors: Partial<Record<TPositionSlot, string>>;
  onChange: (slot: TPositionSlot, value: TPositionDetail) => void;
  isDisabled: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

/** U1: em Racha 8+, a subdivisão de cada zona do Perfil antes de pedir para entrar. */
export const JoinPositionSection = ({
  outfieldPerTeam,
  rows,
  values,
  errors,
  onChange,
  isDisabled,
  isLoading,
  isError,
  onRetry,
}: TJoinPositionSectionProps) => (
  <View style={styles.section}>
    <View style={styles.head}>
      <Text preset="small" color="muted" style={styles.bold}>
        {positionDetailJoinKicker(outfieldPerTeam)}
      </Text>
      <Text color="muted">{POSITION_DETAIL_JOIN_TEXT}</Text>
    </View>

    {isLoading ? (
      <ActivityIndicator color={theme.colors.foreground} />
    ) : isError ? (
      <View style={styles.head}>
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {POSITION_DETAIL_LOAD_FAILED}
        </Text>
        <Button title="Tentar de novo" preset="outline" onPress={onRetry} />
      </View>
    ) : (
      rows.map((row) => (
        <View key={row.slot} style={styles.card}>
          <View style={styles.zone}>
            <Text style={styles.bold}>{row.zoneTitle}</Text>
            <Text color="muted">{row.zoneName}</Text>
          </View>
          {row.options.length > 0 ? (
            <PositionDetailField
              label={row.fieldLabel}
              accessibilityLabel={row.accessibilityLabel}
              options={row.options}
              value={values[row.slot]}
              onChange={(value) => onChange(row.slot, value)}
              error={errors[row.slot]}
              isDisabled={isDisabled}
            />
          ) : (
            <Text preset="small" color="muted">
              {row.noChoiceText}
            </Text>
          )}
        </View>
      ))
    )}

    <Text preset="small" color="muted">
      {POSITION_DETAIL_PROFILE_HINT}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  section: { gap: 12 },
  head: { gap: theme.space[4] },
  bold: { fontFamily: "Manrope-Bold" },
  card: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  zone: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});
