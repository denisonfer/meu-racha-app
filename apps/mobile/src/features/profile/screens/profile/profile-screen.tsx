import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  PlayerCard,
  Screen,
  ScreenFooter,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { useChangePhoto } from "./use-change-photo";
import { useProfileScreen } from "./use-profile-screen";

const CARD_WIDTH = 240;

export const ProfileScreen = () => {
  const { card, isLoading, retry, isRetrying, signOut, isSigningOut } =
    useProfileScreen();
  const { changePhoto, isChangingPhoto } = useChangePhoto();

  return (
    <Screen title="Perfil" hasTabBar>
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.foreground} />
        ) : card ? (
          <View style={styles.card}>
            <PlayerCard width={CARD_WIDTH} {...card} />
            <Button
              title="Trocar foto"
              preset="text"
              isLoading={isChangingPhoto}
              onPress={changePhoto}
            />
          </View>
        ) : (
          <EmptyState
            title="Não deu pra carregar seu perfil"
            text="Confira a internet e tente de novo."
            actionLabel="Tentar de novo"
            onAction={retry}
            isLoading={isRetrying}
          />
        )}
      </View>

      <ScreenFooter>
        <Button
          title="Sair"
          preset="secondary"
          isLoading={isSigningOut}
          onPress={signOut}
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
  },
  card: { alignItems: "center", gap: theme.space[8] },
});
