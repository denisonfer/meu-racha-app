import { TScreenProps } from "./screen-types";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { useNavigation } from "expo-router";
import { Text } from "../text/text";

export type THeaderProps = Pick<
  TScreenProps,
  "title" | "canGoBack" | "headerComponent"
>;

export const Header = ({ title, canGoBack, headerComponent }: THeaderProps) => {
  const { goBack } = useNavigation();

  if (!title && !canGoBack && !headerComponent) {
    return null;
  }

  const isVisibleLabelGoBack = !title && !headerComponent;

  return (
    <View style={styles.container}>
      {canGoBack ? (
        <Pressable
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={[
            {
              marginRight: isVisibleLabelGoBack ? theme.space[8] : undefined,
            },
            styles.goBackButton,
          ]}
        >
          {isVisibleLabelGoBack ? <Text>Voltar</Text> : null}
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {headerComponent}

      {title && <Text>{title}</Text>}

      {title && <View style={styles.spacer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.space[16],
  },
  goBackButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    width: theme.space[24],
  },
});
