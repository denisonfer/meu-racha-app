import { normalizeInviteCode } from "@meu-racha/domain";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/features/auth";
import { getPendingInvite } from "@/features/racha";

export default function AuthLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return null;

  if (session) {
    const code = normalizeInviteCode(getPendingInvite() ?? "");
    return <Redirect href={code ? `/r/${code}` : "/rachas"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
