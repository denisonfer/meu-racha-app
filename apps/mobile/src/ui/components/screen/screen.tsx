import { TScreenProps } from "./screen-types";
import { Container, ScrollContainer } from "./containers";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { Header } from "./header";
import { theme } from "@/ui/theme";

const useAndroidKeyboardInset = () => {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      setInset(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setInset(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
};

export const Screen = ({
  children,
  headerComponent,
  isScrollable,
  title,
  canGoBack,
  onGoBack,
  backgroundColor = "background",
  hasTabBar = false,
  style,
  ...props
}: TScreenProps) => {
  const { top, bottom } = useAppSafeArea();
  const keyboardInset = useAndroidKeyboardInset();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.colors[backgroundColor] },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={!isScrollable}
      >
        <View
          {...props}
          style={[
            styles.screen,
            {
              paddingTop: top,
              paddingBottom: (hasTabBar ? 0 : bottom) + keyboardInset,
            },
            style,
          ]}
        >
          <Header
            title={title}
            canGoBack={canGoBack}
            onGoBack={onGoBack}
            headerComponent={headerComponent}
          />

          <View style={styles.content}>
            {isScrollable ? (
              <ScrollContainer backgroundColor={backgroundColor}>
                {children}
              </ScrollContainer>
            ) : (
              <Container backgroundColor={backgroundColor}>
                {children}
              </Container>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: theme.space[16],
  },
});
