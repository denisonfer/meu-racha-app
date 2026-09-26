import { StyleSheet, View } from "react-native";
import { useSession, useSignOut } from "@/features/auth";
import { Button, Screen, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export const HomeScreen = () => {
  const { session } = useSession();
  const { signOut, isPending } = useSignOut();

  return (
    <Screen>
      <View style={styles.content}>
        <Text preset="h2">Você está dentro</Text>
        <Text preset="small" color="muted">
          {session?.email}
        </Text>
      </View>

      <ScreenFooter>
        <Button
          title="Sair"
          preset="secondary"
          isLoading={isPending}
          onPress={() => signOut()}
        />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[8],
  },
});
