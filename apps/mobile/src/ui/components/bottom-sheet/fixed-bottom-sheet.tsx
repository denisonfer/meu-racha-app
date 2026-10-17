import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { theme } from "@/ui/theme";
import { Icon } from "../icon";
import { Text } from "../text/text";
import type { TBottomSheetProps } from "./bottom-sheet";

// a folha é desenhada em JS: a rota só precisa de uma tela transparente por baixo
export const FIXED_BOTTOM_SHEET_SCREEN_OPTIONS = {
  presentation: "transparentModal",
  animation: "fade",
  contentStyle: { backgroundColor: "transparent" },
} as const;

/**
 * Folha que não fecha por arrasto: só pelo X, pelo fundo ou pelo voltar.
 * Para listas roláveis, onde o formSheet nativo do Android fecha a folha
 * quando o dedo desce para voltar ao topo da lista.
 */
export const FixedBottomSheet = ({
  title,
  leading,
  supporting,
  hasCloseButton = true,
  isBusy = false,
  children,
}: TBottomSheetProps) => {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const { bottom } = useAppSafeArea();

  useEffect(() => {
    if (!isBusy) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => subscription.remove();
  }, [isBusy]);

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose={false}
      // o arrasto no miolo fica com a ScrollView da tela, que tem teto de
      // altura; um BottomSheetScrollView faria a folha medir a lista inteira
      enableContentPanningGesture={false}
      onClose={() => router.back()}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior={isBusy ? "none" : "close"}
        />
      )}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView
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
              onPress={() => sheetRef.current?.close()}
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
      </BottomSheetView>
    </GorhomBottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 24,
  },
  handle: { backgroundColor: theme.colors.border },
  sheet: { gap: 20, paddingTop: theme.space[8], paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerTexts: { flex: 1, gap: 2, paddingTop: 2 },
  closeButton: {
    width: theme.minTouch,
    height: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
