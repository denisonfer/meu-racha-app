import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from "expo-router";
import { useEffect } from "react";
import { LogBox, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { environment } from "@/lib/environment";
import { EnvironmentBadge, ToastProvider } from "@/ui/components";
import { theme } from "@/ui/theme";

SplashScreen.preventAutoHideAsync();

// o toast de avisos do LogBox cobre o rodapé e rouba o toque do Maestro
if (process.env.EXPO_PUBLIC_E2E === "1") LogBox.ignoreAllLogs();

// Com o app aberto o banner também aparece (decisão do dono, 10/10/2026).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// sem tema a navegação pinta o fundo claro padrão, que pisca entre telas
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.background,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "Manrope-Medium": require("../../assets/fonts/Manrope-Medium.ttf"),
    "Manrope-Bold": require("../../assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("../../assets/fonts/Manrope-ExtraBold.ttf"),
    "BarlowCondensed-Bold": require("../../assets/fonts/BarlowCondensed-Bold.ttf"),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* home autenticada: gesto não pode voltar ao login */}
              <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
            </Stack>
            {environment.name === "staging" && <EnvironmentBadge />}
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // a folha em JS (BottomSheet) depende do gesture-handler na raiz
  root: { flex: 1 },
});
