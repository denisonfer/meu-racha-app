import { ActivityIndicator, StyleSheet, View } from "react-native";
import { EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { JoinRequestRow } from "../../components/join-request-row";
import { useJoinRequestsScreen } from "./use-join-requests-screen";

export const JoinRequestsScreen = () => {
  const {
    requests,
    countLabel,
    isLoading,
    isError,
    retry,
    isRetrying,
    shareInvite,
  } = useJoinRequestsScreen();

  return (
    <Screen title="Pedidos para entrar" canGoBack isScrollable>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel="Carregando pedidos"
        />
      ) : isError ? (
        <EmptyState
          title="Não deu pra abrir os pedidos"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Nenhum pedido para entrar"
          text="Quem pedir para entrar pelo convite aparece aqui."
          actionLabel="Compartilhar convite"
          onAction={shareInvite}
        />
      ) : (
        <View style={styles.list}>
          <Text preset="small" color="muted" style={styles.bold}>
            {countLabel}
          </Text>
          {requests.map(({ id, ...request }) => (
            <JoinRequestRow key={id} {...request} />
          ))}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { gap: 12 },
  bold: { fontFamily: "Manrope-Bold" },
});
