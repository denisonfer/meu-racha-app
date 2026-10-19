import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router, useNavigation } from "expo-router";
import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { theme } from "@/ui/theme";
import { Icon } from "../icon";
import { Text } from "../text/text";

// a folha é desenhada em JS: a rota só precisa de uma tela transparente por baixo
export const BOTTOM_SHEET_SCREEN_OPTIONS = {
  presentation: "transparentModal",
  animation: "fade",
  contentStyle: { backgroundColor: "transparent" },
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
  /** Desabilita o X, o fundo e o voltar. */
  isBusy?: boolean;
}>;

export function useBottomSheetClose() {
  const navigation = useNavigation();

  // a folha pode já ter saído pelo X ou pelo fundo quando a ação termina:
  // voltar de novo tiraria a tela de baixo da pilha
  return () => {
    if (navigation.isFocused()) router.back();
  };
}

/**
 * Não fecha por arrasto, só pelo X, pelo fundo ou pelo voltar: no formSheet
 * nativo do Android, rolar uma lista para cima fechava a folha.
 * Formulário com campo de texto vai para tela cheia, não para folha.
 */
export const BottomSheet = ({
  title,
  leading,
  supporting,
  hasCloseButton = true,
  isBusy = false,
  children,
}: TBottomSheetProps) => {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const close = useBottomSheetClose();
  const { bottom } = useAppSafeArea();
  // sem gesto no miolo (o arrasto está desligado), o toque numa View comum
  // da folha descia até o toque do fundo no Android e fechava a folha; este
  // nunca ativa, então só para a busca e não tira o toque dos Pressable
  const blockFallThrough = useMemo(() => Gesture.Manual(), []);

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
      onClose={close}
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
      <GestureDetector gesture={blockFallThrough}>
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
      </GestureDetector>
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
