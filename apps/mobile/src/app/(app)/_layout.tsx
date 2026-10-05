import { Redirect, Stack, usePathname } from "expo-router";
import { savePendingDestination, useSession } from "@/features/auth";
import { BOTTOM_SHEET_SCREEN_OPTIONS } from "@/ui/components";

// sem âncora, a folha (1ª declarada) viraria a raiz da pilha
export const unstable_settings = {
  anchor: "(tabs)",
};

export default function AppLayout() {
  const { session, isLoading } = useSession();
  // só o caminho: nenhuma rota de (app) usa parâmetros de busca
  const pathname = usePathname();

  if (isLoading) return null;
  if (!session) {
    void savePendingDestination(pathname);
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="racha/[id]/approve/[requestId]"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/delete"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/member/[profileId]/expel"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/member/[profileId]/transfer"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/leave"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/position-detail"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/assume"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/cancel"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/finish"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/guest"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/remove-guest"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/monthly-pass"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/sort-confirm"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/sort-leave"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/sort-include"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-goal"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-finish"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-discard"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-goalkeeper"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-roster"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-queue"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-leave"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="racha/[id]/event/[eventId]/match-reinforcement"
        options={BOTTOM_SHEET_SCREEN_OPTIONS}
      />
    </Stack>
  );
}
