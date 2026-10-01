import { PropsWithChildren, useCallback, useEffect, useRef } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type HostInstance,
} from "react-native";
import { theme } from "@/ui/theme";

const FOCUSED_INPUT_GAP = 48;

const useScrollFocusedInput = () => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardOpen = useRef(false);

  const align = useCallback(() => {
    if (!keyboardOpen.current) return;

    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current as (ScrollView & HostInstance) | null;
    if (!input || !scroll) return;

    scroll.measureInWindow((_x, top, _width, height) => {
      input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
        const overflow =
          inputTop + inputHeight + FOCUSED_INPUT_GAP - (top + height);
        if (overflow > 0) {
          scroll.scrollTo({ y: scrollY.current + overflow, animated: true });
        }
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
      requestAnimationFrame(align);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [align]);

  return {
    scrollRef,
    align,
    onScroll: (offsetY: number) => {
      scrollY.current = offsetY;
    },
  };
};

export const RachaFormScroll = ({ children }: PropsWithChildren) => {
  const { scrollRef, align, onScroll } = useScrollFocusedInput();

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={(event) => {
        onScroll(event.nativeEvent.contentOffset.y);
      }}
      onLayout={align}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: theme.space[24], paddingBottom: theme.space[24] },
});
