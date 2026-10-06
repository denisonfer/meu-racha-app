import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { Text } from "../text/text";
import { BolinhaMark } from "./bolinha-mark";

export type TBolinhaProps = {
  state: "hidden" | "blue" | "red";
  size?: number;
  // anel lima de "ainda fechada"
  isHolding?: boolean;
};

export const Bolinha = ({
  state,
  size = 40,
  isHolding = false,
}: TBolinhaProps) => {
  const isHidden = state === "hidden";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isHidden
            ? theme.colors.surfaceRaised
            : state === "blue"
              ? theme.colors.bolinhaAzul
              : theme.colors.bolinhaVermelha,
        },
        isHidden && styles.hidden,
        isHolding && styles.holding,
      ]}
    >
      {isHidden ? (
        <Text
          style={{
            fontFamily: "BarlowCondensed-Bold",
            fontSize: size * 0.5,
            lineHeight: size * 0.5 + 2,
          }}
        >
          ?
        </Text>
      ) : (
        <BolinhaMark isBlue={state === "blue"} size={size / 2} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ball: { alignItems: "center", justifyContent: "center" },
  hidden: { borderWidth: 3, borderColor: theme.colors.border },
  holding: { borderWidth: 3, borderColor: "rgba(198, 242, 78, 0.25)" },
});
