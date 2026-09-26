import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSignIn } from "../../hooks/use-sign-in";
import { signInSchema, TSignInForm } from "./sign-in-schema";
import { router } from "expo-router";

export function useSignInScreen() {
  const { signIn, isPending } = useSignIn();

  const { control, handleSubmit } = useForm<TSignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { username: "", password: "" },
    mode: "onBlur",
  });

  const navigateToSignUp = () => {
    router.push("/sign-up");
  };

  return {
    control,
    isPending,
    submit: handleSubmit((values) => signIn(values)),
    navigateToSignUp,
  };
}
