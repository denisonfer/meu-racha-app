import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/ui/components";

SplashScreen.preventAutoHideAsync();

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
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
