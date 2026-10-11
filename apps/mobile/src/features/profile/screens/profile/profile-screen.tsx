import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Icon,
  PlayerCard,
  Screen,
  ScreenFooter,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { SETTINGS_TITLE } from "../../utils/settings-messages";
import { useChangePhoto } from "./use-change-photo";
import { useProfileScreen } from "./use-profile-screen";

const CARD_WIDTH = 240;

export const ProfileScreen = () => {
  const {
    card,
    isLoading,
    retry,
    isRetrying,
    signOut,
    isSigningOut,
    openSettings,
  } = useProfileScreen();
  const { changePhoto, isChangingPhoto } = useChangePhoto();

  return (
    <Screen
      title="Perfil"
      hasTabBar
      headerRight={
        <Pressable
          onPress={openSettings}
          accessibilityRole="button"
          accessibilityLabel={SETTINGS_TITLE}
          style={({ pressed }) => [
            styles.settingsButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="settings" size={24} />
        </Pressable>
      }
    >
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
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    width: theme.minTouch,
    height: theme.minTouch,
    marginVertical: -10,
    marginRight: -10,
  },
  pressed: { opacity: 0.8 },
});
