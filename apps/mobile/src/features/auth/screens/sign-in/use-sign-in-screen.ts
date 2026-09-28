import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSignIn } from "../../hooks/use-sign-in";
import { signInSchema, TSignInForm } from "./sign-in-schema";
import { router } from "expo-router";

export function useSignInScreen() {
  const { signIn, isPending } = useSignIn();

  const { control, handleSubmit, getValues } = useForm<TSignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const navigateToSignUp = () => {
    router.push("/sign-up");
  };

  const navigateToForgotPassword = () => {
    router.push({
      pathname: "/forgot-password",
      params: { email: getValues("email") },
    });
  };

  return {
    control,
    isPending,
    submit: handleSubmit((values) => signIn(values)),
    navigateToSignUp,
    navigateToForgotPassword,
  };
}
