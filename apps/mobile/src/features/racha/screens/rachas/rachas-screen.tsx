import { StyleSheet, View } from "react-native";
import { Button, EmptyState, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";

export const RachasScreen = () => (
  <Screen title="Meus rachas" hasTabBar>
    <View style={styles.content}>
      <EmptyState
        title="Você ainda não está em nenhum racha"
        text="Crie o seu ou entre num racha com o código de convite."
        actionLabel="Criar racha"
        onAction={() => {}}
      />
      <Button title="Entrar com código" preset="text" onPress={() => {}} />
    </View>
  </Screen>
);

const styles = StyleSheet.create({
  content: { gap: theme.space[16] },
});
