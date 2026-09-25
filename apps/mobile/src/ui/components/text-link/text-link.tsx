import { StyleSheet } from "react-native";
import { Text, TTextProps } from "../text/text";

export type TTextLinkProps = TTextProps & {
  onPress: () => void;
};

/**
 * Trecho clicável dentro de um parágrafo — "Li e aceito os Termos de Uso".
 * É um Text com onPress: aninhado em outro Text, ele continua na mesma linha,
 * o que um Pressable não faz.
 */
export const TextLink = ({
  onPress,
  style,
  color = "action",
  ...props
}: TTextLinkProps) => {
  return (
    <Text
      {...props}
      color={color}
      onPress={onPress}
      accessibilityRole="link"
      style={[styles.link, style]}
    />
  );
};

const styles = StyleSheet.create({
  link: {
    textDecorationLine: "underline",
  },
});
