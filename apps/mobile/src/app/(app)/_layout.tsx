import { Redirect, Stack, usePathname } from "expo-router";
import { useSession } from "@/features/auth";
import { savePendingInvite } from "@/features/racha";

const INVITE_PATH = "/r/";

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const pathname = usePathname();

  if (isLoading) return null;
  if (!session) {
    // link de convite sem sessão: o código espera o login e o
    // (auth)/_layout volta pro Convite
    if (pathname.startsWith(INVITE_PATH)) {
      savePendingInvite(pathname.slice(INVITE_PATH.length));
    }
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
