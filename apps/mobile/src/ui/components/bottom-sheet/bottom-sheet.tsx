import { PropsWithChildren, ReactNode, useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { theme } from "@/ui/theme";
import { Icon } from "../icon";
import { Text } from "../text/text";

export const BOTTOM_SHEET_SCREEN_OPTIONS = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  // a folha nativa pode ser mais alta que o conteúdo: sem isto a sobra fica na cor do tema de navegação
  contentStyle: { backgroundColor: theme.colors.surfaceRaised },
} as const;

export type TBottomSheetProps = PropsWithChildren<{
  title: string;
  /** Antes do título — o avatar, na de aprovar. */
  leading?: ReactNode;
  /** Linhas abaixo do título. */
  supporting?: ReactNode;
  /**
   * @default true
   */
  hasCloseButton?: boolean;
  /** Desabilita o fechar e o gesto de arrastar. */
  isBusy?: boolean;
}>;

export function useBottomSheetClose() {
  const navigation = useNavigation();

  // no Android o formSheet ignora gestureEnabled: se a folha já saiu, voltar tiraria a tela de baixo da pilha
  return () => {
    if (navigation.isFocused()) router.back();
  };
}

export const BottomSheet = ({
  title,
  leading,
  supporting,
  hasCloseButton = true,
  isBusy = false,
  children,
}: TBottomSheetProps) => {
  const navigation = useNavigation();
  const close = useBottomSheetClose();
  const { bottom } = useAppSafeArea();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isBusy });
  }, [navigation, isBusy]);

  useEffect(() => {
    if (!isBusy) return;
    // o gesto de arrastar o Android não bloqueia: o botão físico de voltar precisa ser engolido também
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => subscription.remove();
  }, [isBusy]);

  return (
    <View
      accessibilityViewIsModal
      style={[styles.sheet, { paddingBottom: bottom }]}
    >
      <View style={styles.header}>
        {leading}
        <View style={styles.headerTexts}>
          <Text preset="h2" accessibilityRole="header">
            {title}
          </Text>
          {supporting}
        </View>
        {hasCloseButton ? (
          <Pressable
            onPress={close}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            accessibilityState={{ disabled: isBusy }}
            style={styles.closeButton}
          >
            <Icon name="close" size={22} />
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    gap: 20,
    paddingTop: theme.space[24],
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surfaceRaised,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerTexts: { flex: 1, gap: 2, paddingTop: 2 },
  closeButton: {
    width: theme.minTouch,
    height: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
