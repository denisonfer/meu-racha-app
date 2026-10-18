import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Icon,
  NoticeBanner,
  PlayerCard,
  Screen,
  ScreenFooter,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  EMAIL_ALERT_ACTION,
  EMAIL_ALERT_TEXT,
  EMAIL_ALERT_TITLE,
} from "../../utils/profile-messages";
import { SETTINGS_TITLE } from "../../utils/settings-messages";
import { useChangePhoto } from "./use-change-photo";
import { useProfileScreen } from "./use-profile-screen";

// o alerta toma altura: a carta encolhe para tudo caber sem rolar
const CARD_WIDTH = 240;
const CARD_WIDTH_WITH_ALERT = 210;

export const ProfileScreen = () => {
  const {
    card,
    isLoading,
    retry,
    isRetrying,
    signOut,
    isSigningOut,
    openSettings,
    hasEmailAlert,
    openConfirmEmail,
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
      {hasEmailAlert ? (
        <View style={styles.alert}>
          <NoticeBanner
            tone="warning"
            title={EMAIL_ALERT_TITLE}
            text={EMAIL_ALERT_TEXT}
            actionLabel={EMAIL_ALERT_ACTION}
            onAction={openConfirmEmail}
          />
        </View>
      ) : null}
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.foreground} />
        ) : card ? (
          <View style={styles.card}>
            <PlayerCard
              width={hasEmailAlert ? CARD_WIDTH_WITH_ALERT : CARD_WIDTH}
              {...card}
            />
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
  alert: { paddingBottom: theme.space[8] },
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
