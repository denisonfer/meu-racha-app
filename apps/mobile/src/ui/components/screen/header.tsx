import { TScreenProps } from "./screen-types";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { useNavigation } from "expo-router";
import { Text } from "../text/text";
import { Icon } from "../icon";

export type THeaderProps = Pick<
  TScreenProps,
  "title" | "canGoBack" | "headerComponent" | "onGoBack"
>;

export const Header = ({
  title,
  canGoBack,
  headerComponent,
  onGoBack,
}: THeaderProps) => {
  const { goBack } = useNavigation();

  if (!title && !canGoBack && !headerComponent) {
    return null;
  }

  const isVisibleLabelGoBack = !title && !headerComponent;

  return (
    <View style={styles.container}>
      {canGoBack ? (
        <Pressable
          onPress={onGoBack ?? goBack}
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
          {/* o chevron aparece sempre: sem ele o Pressable fica sem conteúdo
              (e sem área de toque) quando a tela tem título */}
          <Icon name="back" size={24} />
          {isVisibleLabelGoBack ? <Text>Voltar</Text> : null}
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {headerComponent}

      {title ? <Text preset="h3">{title}</Text> : null}

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
