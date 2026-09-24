import { TScreenProps } from "./screen-types";
import { Container, ScrollContainer } from "./containers";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { Header } from "./header";
import { theme } from "@/ui/theme";

export const Screen = ({
  children,
  headerComponent,
  isScrollable,
  title,
  canGoBack,
  backgroundColor = "background",
  style,
  ...props
}: TScreenProps) => {
  const { top, bottom } = useAppSafeArea();

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
              paddingBottom: bottom,
            },
            style,
          ]}
        >
          <Header
            title={title}
            canGoBack={canGoBack}
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
