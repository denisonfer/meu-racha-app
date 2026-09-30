import { Href, Redirect, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { takePendingDestination, useSession } from "@/features/auth";

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  const [destination, setDestination] = useState<string | null>();
  const userId = session?.userId;

  // no foco, como o Redirect: com a troca de senha aberta por cima, o destino é dela
  useFocusEffect(
    useCallback(() => {
      if (userId) void takePendingDestination(userId).then(setDestination);
    }, [userId])
  );

  if (isLoading) return null;

  if (session) {
    if (destination === undefined) return null;
    return <Redirect href={(destination ?? "/rachas") as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
