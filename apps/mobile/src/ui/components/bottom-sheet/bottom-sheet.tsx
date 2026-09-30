import { PropsWithChildren, ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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

  // no Android o formSheet ignora gestureEnabled: se a folha já saiu, voltar tiraria a lista da pilha
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
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerTexts: { flex: 1, gap: 2, paddingTop: 2 },
  closeButton: {
    width: theme.minTouch,
    height: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    marginRight: -10,
  },
});
