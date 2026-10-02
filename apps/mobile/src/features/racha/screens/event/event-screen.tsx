import { ActivityIndicator } from "react-native";
import { EmptyState, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";
import { EventForm } from "./event-form";
import { useEventScreen } from "./use-event-screen";

export const EventScreen = () => {
  const { mode, racha, event, isLoading, retry, isRetrying } = useEventScreen();

  const editor =
    racha == null
      ? null
      : mode === "edit"
        ? event
          ? { mode: "edit" as const, racha, event }
          : null
        : { mode: "create" as const, racha };

  return (
    <Screen
      title={mode === "create" ? "Criar evento" : "Editar evento"}
      canGoBack
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : !editor ? (
        <EmptyState
          title="Não deu pra abrir o racha"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <EventForm editor={editor} />
      )}
    </Screen>
  );
};
