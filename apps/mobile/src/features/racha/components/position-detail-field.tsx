import type { TPositionDetail } from "@meu-racha/domain";
import { StyleSheet, View } from "react-native";
import { ChipGroup, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export type TPositionDetailFieldProps = {
  label: string;
  // "Na defesa, principal": a zona e o lugar dela no Perfil
  accessibilityLabel: string;
  options: { value: TPositionDetail; label: string }[];
  value: TPositionDetail | null;
  onChange: (value: TPositionDetail) => void;
  error?: string;
  isDisabled?: boolean;
};

/** Subdivisão logo abaixo da zona, recuada com a borda na cor de ação. */
export const PositionDetailField = ({
  label,
  accessibilityLabel,
  options,
  value,
  onChange,
  error,
  isDisabled = false,
}: TPositionDetailFieldProps) => (
  <View style={styles.box}>
    <ChipGroup
      label={label}
      accessibilityLabel={accessibilityLabel}
      options={options}
      value={value}
      onChange={onChange}
      isDisabled={isDisabled}
    />
    {error ? (
      <Text preset="small" color="errorText" accessibilityRole="alert">
        {error}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  box: {
    gap: theme.space[8],
    paddingVertical: theme.space[4],
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.action,
  },
});
