import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/ui/components";

SplashScreen.preventAutoHideAsync();

// Com o app aberto o banner também aparece (decisão do dono, 10/10/2026).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {/* home autenticada: gesto não pode voltar ao login */}
            <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
          </Stack>
        </ToastProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // a folha em JS (FixedBottomSheet) depende do gesture-handler na raiz
  root: { flex: 1 },
});
