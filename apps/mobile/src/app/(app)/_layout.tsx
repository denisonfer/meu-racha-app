import { Redirect, Stack, usePathname } from "expo-router";
import { useSession } from "@/features/auth";
import { savePendingInvite } from "@/features/racha";

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
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
    </Stack>
  );
}
