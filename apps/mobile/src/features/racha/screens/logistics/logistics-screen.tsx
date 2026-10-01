import { ActivityIndicator } from "react-native";
import { EmptyState, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";
import { LogisticsForm } from "./logistics-form";
import { useLogisticsScreen } from "./use-logistics-screen";

export const LogisticsScreen = () => {
  const { racha, isLoading, retry, isRetrying } = useLogisticsScreen();

  return (
    <Screen title="Logística" canGoBack>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : !racha ? (
        <EmptyState
          title="Não deu pra abrir o racha"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <LogisticsForm racha={racha} />
      )}
    </Screen>
  );
};
