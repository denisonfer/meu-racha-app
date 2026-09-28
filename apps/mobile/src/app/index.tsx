import { Redirect } from "expo-router";
import { useSession } from "@/features/auth";

export default function Index() {
  const { session, isLoading } = useSession();

  if (isLoading) return null;

  return <Redirect href={session ? "/rachas" : "/sign-in"} />;
}
