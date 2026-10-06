import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";

export type TOptionListOption<V extends string> = {
  value: V;
  title: string;
  description?: string;
  leading?: ReactNode;
};

export type TOptionListProps<V extends string> = {
  options: TOptionListOption<V>[];
  value: V;
  onChange: (value: V) => void;
  isDisabled?: boolean;
};

// Escolha única com explicação em cada opção — quando o chip não comporta
// o texto que a pessoa precisa ler para decidir.
export function OptionList<V extends string>({
  options,
  value,
  onChange,
  isDisabled = false,
}: TOptionListProps<V>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isChecked = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={isDisabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: isChecked, disabled: isDisabled }}
            style={({ pressed }) => [
              styles.row,
              isChecked ? styles.rowChecked : styles.rowUnchecked,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View
              style={[
                styles.ring,
                {
                  borderColor: isChecked
                    ? theme.colors.action
                    : theme.colors.muted,
                },
              ]}
            >
              {isChecked ? <View style={styles.dot} /> : null}
            </View>

            {option.leading ? (
              <View style={styles.leading}>{option.leading}</View>
            ) : null}

            <View style={styles.texts}>
              <Text style={styles.title}>{option.title}</Text>
              {option.description ? (
                <Text preset="small" color="muted">
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: theme.space[8],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: theme.minTouch,
    borderRadius: theme.radius.control,
  },
  // o padding compensa a borda mais grossa: o texto não pula ao selecionar
  rowChecked: {
    padding: 13,
    borderWidth: 2,
    borderColor: theme.colors.action,
  },
  rowUnchecked: {
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action,
  },
  leading: { marginTop: 1 },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Manrope-Bold",
    lineHeight: 22,
  },
});
