import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { ScreenFooter } from "@/ui/components";
import { theme } from "@/ui/theme";

type TSortPageProps = PropsWithChildren<{
  // ação fixa no rodapé, fora da rolagem
  footer: ReactNode;
}>;

export const SortPage = ({ children, footer }: TSortPageProps) => (
  <>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroll}
    >
      {children}
    </ScrollView>
    {footer ? <ScreenFooter>{footer}</ScreenFooter> : null}
  </>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 12, paddingBottom: theme.space[24] },
});
