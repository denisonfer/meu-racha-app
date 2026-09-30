import { Redirect, Stack, usePathname } from "expo-router";
import { useSession } from "@/features/auth";
import { savePendingInvite } from "@/features/racha";
import { BOTTOM_SHEET_SCREEN_OPTIONS } from "@/ui/components";

const INVITE_PATH = "/r/";

// sem âncora, a folha (1ª declarada) viraria a raiz da pilha
export const unstable_settings = {
  anchor: "(tabs)",
};

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const pathname = usePathname();

  if (isLoading) return null;
  if (!session) {
    if (pathname.startsWith(INVITE_PATH)) {
      savePendingInvite(pathname.slice(INVITE_PATH.length));
    }
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
    </Stack>
  );
}
