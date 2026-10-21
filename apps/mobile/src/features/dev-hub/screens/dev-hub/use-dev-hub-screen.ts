import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  buildEnvironmentLabel,
  enterStaging,
  environment,
  leaveStaging,
} from "@/lib/environment";
import { useToast } from "@/ui/components";
import { devHubApi } from "../../dev-hub-api";
import { DevHubError } from "../../utils/staging-config";
import { devHubSchema, TDevHubForm } from "./dev-hub-schema";

export function useDevHubScreen() {
  const showToast = useToast();

  const { control, handleSubmit, setError } = useForm<TDevHubForm>({
    resolver: zodResolver(devHubSchema),
    defaultValues: { key: "" },
  });

  // o voltar do iOS/Android segue ativo durante a chamada: fechado o DevHub, não reinicia o app
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // síncrona: o isPending só muda no próximo render, e o handleSubmit é assíncrono,
  // então dois envios seguidos ainda veriam isPending=false
  const inFlight = useRef(false);
  const run = (start: () => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    start();
  };

  // no sucesso o app reinicia, então o isPending preso até lá é o esperado (trava toque duplo)
  const enter = useMutation({
    mutationFn: async (key: string) => {
      const config = await devHubApi.fetchStagingConfig(key);
      if (isMounted.current) await enterStaging(config);
    },
    onError: (error) => {
      if (error instanceof DevHubError && error.kind === "invalidKey") {
        setError("key", { message: "Chave inválida." });
        return;
      }
      showToast("Não foi possível falar com o servidor. Tente de novo.");
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const leave = useMutation({
    mutationFn: leaveStaging,
    onError: () => showToast("Não foi possível voltar. Tente de novo."),
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const isPending = enter.isPending || leave.isPending;

  return {
    control,
    isStaging: environment.name === "staging",
    buildLabel: buildEnvironmentLabel,
    isPending,
    // handleSubmit dentro do handler: o lint de refs não aceita o callback criado no render
    submit: () => handleSubmit(({ key }) => run(() => enter.mutate(key)))(),
    leave: () => {
      run(() => leave.mutate());
    },
    close: () => router.back(),
  };
}
