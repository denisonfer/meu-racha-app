import { StyleSheet, View } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { StepButton } from "./step-button";

export type TStepperProps = {
  label?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
  isDisabled?: boolean;
};

export const Stepper = ({
  label,
  value,
  min,
  max,
  onChange,
  hint,
  isDisabled = false,
}: TStepperProps) => {
  const canDecrement = !isDisabled && value > min;
  const canIncrement = !isDisabled && value < max;

  return (
    // A linha inteira é um único elemento "adjustable": o leitor de tela
    // ajusta com swipe para cima/baixo em vez de caçar dois botões pequenos.
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled }}
      // text é obrigatório: sem ele o iOS lê min/max/now como porcentagem
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" && canIncrement) {
          onChange(value + 1);
        }
        if (event.nativeEvent.actionName === "decrement" && canDecrement) {
          onChange(value - 1);
        }
      }}
    >
      {label || hint ? (
        <View style={styles.texts}>
          {label ? (
            <Text
              style={styles.label}
              color={isDisabled ? "textDisabled" : "foreground"}
            >
              {label}
            </Text>
          ) : null}
          {hint ? (
            <Text preset="small" color={isDisabled ? "mutedDisabled" : "muted"}>
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.controls}>
        <StepButton
          icon="minus"
          isEnabled={canDecrement}
          onPress={() => onChange(value - 1)}
        />
        <Text
          preset="stat"
          color={isDisabled ? "textDisabled" : "foreground"}
          style={styles.value}
        >
          {value}
        </Text>
        <StepButton
          icon="plus"
          isEnabled={canIncrement}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
  },
  texts: {
    flex: 1,
    gap: theme.space[4],
  },
  label: {
    fontFamily: "Manrope-Bold",
    lineHeight: 22,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[4],
  },
  value: {
    minWidth: 36,
    textAlign: "center",
    // largura fixa por dígito: o número trocando não empurra os botões
    fontVariant: ["tabular-nums"],
  },
});
