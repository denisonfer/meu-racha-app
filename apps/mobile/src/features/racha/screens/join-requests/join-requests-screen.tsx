import { ActivityIndicator, StyleSheet, View } from "react-native";
import { EmptyState, NoticeBanner, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { JoinRequestRow } from "../../components/join-request-row";
import {
  PUSH_DENIED_ACTION,
  PUSH_DENIED_TEXT,
  PUSH_DENIED_TITLE,
} from "../../utils/racha-messages";
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
    showPushDenied,
    openSettings,
  } = useJoinRequestsScreen();

  return (
    <Screen title="Pedidos para entrar" canGoBack isScrollable>
      <View style={styles.page}>
        {showPushDenied ? (
          <NoticeBanner
            tone="warning"
            title={PUSH_DENIED_TITLE}
            text={PUSH_DENIED_TEXT}
            actionLabel={PUSH_DENIED_ACTION}
            onAction={openSettings}
          />
        ) : null}
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
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  page: { gap: 20 },
  list: { gap: 12 },
  bold: { fontFamily: "Manrope-Bold" },
});
