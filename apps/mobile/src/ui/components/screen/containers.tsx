import { theme, TThemeColor } from "@/ui/theme";
import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, ViewProps } from "react-native";

type TContainerProps = ViewProps &
  PropsWithChildren & {
    backgroundColor: TThemeColor;
  };

export const Container = ({
  children,
  backgroundColor,
  ...props
}: TContainerProps) => {
  return (
    <View
      {...props}
      style={[
        styles.container,
        { backgroundColor: theme.colors[backgroundColor] },
      ]}
    >
      {children}
    </View>
  );
};

export const ScrollContainer = ({
  children,
  backgroundColor,
  ...props
}: TContainerProps) => {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      {...props}
      style={[
        styles.container,
        { backgroundColor: theme.colors[backgroundColor] },
      ]}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
