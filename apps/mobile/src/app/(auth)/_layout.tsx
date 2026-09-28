import { Redirect, Stack } from "expo-router";
import { useSession } from "@/features/auth";

export default function AuthLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) return null;

  if (session) return <Redirect href="/rachas" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
