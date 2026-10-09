import { Href, Redirect, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  takePendingDestination,
  usePhotoHold,
  useSession,
} from "@/features/auth";

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  const isPhotoHeld = usePhotoHold();
  const [destination, setDestination] = useState<string | null>();
  const userId = session?.userId;

  // no foco, como o Redirect: com a troca de senha aberta por cima, o destino é dela
  useFocusEffect(
    useCallback(() => {
      if (userId) void takePendingDestination(userId).then(setDestination);
    }, [userId])
  );

  if (isLoading) return null;

  // o Cadastro só entrega a pessoa ao app com a foto salva
  if (session && !isPhotoHeld) {
    if (destination === undefined) return null;
    return <Redirect href={(destination ?? "/rachas") as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
