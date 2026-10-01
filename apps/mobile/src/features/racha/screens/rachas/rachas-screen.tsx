import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Icon,
  NoticeBanner,
  Screen,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { JoinRequestCard } from "../../components/join-request-card";
import { useRachasScreen } from "./use-rachas-screen";
import { RachaCard } from "./racha-card";

export const RachasScreen = () => {
  const {
    notices,
    rachas,
    joinRequests,
    isLoading,
    isError,
    retry,
    isRetrying,
    createRacha,
    openRacha,
    cancelJoinRequest,
    enterCode,
  } = useRachasScreen();

  const hasItems = rachas.length > 0 || joinRequests.length > 0;

  return (
    <Screen hasTabBar isScrollable>
      <View style={styles.header}>
        <Text preset="h1" style={styles.title}>
          Rachas
        </Text>
        {hasItems ? (
          <Button title="Criar racha" preset="text" onPress={createRacha} />
        ) : null}
      </View>

      <View style={styles.content}>
        {notices.length > 0 ? (
          <View style={styles.notices}>
            {notices.map((notice) => (
              <NoticeBanner
                key={notice.id}
                tone="warning"
                title={notice.title}
                text={notice.text}
                actionLabel="Entendi"
                onAction={notice.dismiss}
              />
            ))}
          </View>
        ) : null}
        {isLoading ? (
          <ActivityIndicator color={theme.colors.foreground} />
        ) : isError ? (
          <EmptyState
            title="Não deu pra carregar seus rachas"
            text="Confira a internet e tente de novo."
            actionLabel="Tentar de novo"
            onAction={retry}
            isLoading={isRetrying}
          />
        ) : hasItems ? (
          <>
            {rachas.map((racha) => (
              <RachaCard
                key={racha.id}
                {...racha}
                onPress={() => openRacha(racha.id)}
              />
            ))}
            {joinRequests.length > 0 ? (
              <>
                <Text preset="small" color="muted" style={styles.bold}>
                  Pedidos enviados
                </Text>
                {joinRequests.map((request) => (
                  <JoinRequestCard
                    key={request.rachaId}
                    rachaName={request.rachaName}
                    isCancelling={request.isCancelling}
                    isCancelDisabled={request.isCancelDisabled}
                    onCancel={() => cancelJoinRequest(request.rachaId)}
                  />
                ))}
              </>
            ) : null}
            <Pressable
              onPress={enterCode}
              accessibilityRole="button"
              accessibilityLabel="Entrar com código"
              accessibilityHint="Recebeu um código de 6 caracteres? Use aqui."
              style={({ pressed }) => [
                styles.joinRow,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="ticket" size={22} />
              <View style={styles.grow}>
                <Text style={styles.bold}>Entrar com código</Text>
                <Text preset="small" color="muted">
                  Recebeu um código de 6 caracteres? Use aqui.
                </Text>
              </View>
              <Icon name="chevron-right" color="muted" />
            </Pressable>
          </>
        ) : (
          <>
            <EmptyState
              title="Você ainda não está em nenhum racha"
              text="Crie o seu ou entre num racha com o código de convite."
              actionLabel="Criar racha"
              onAction={createRacha}
            />
            <Button
              title="Entrar com código"
              preset="text"
              onPress={enterCode}
            />
          </>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: theme.space[16],
  },
  title: { flex: 1, fontFamily: "Manrope-ExtraBold" },
  content: { gap: 12 },
  notices: { gap: 12, marginBottom: theme.space[4] }, // 12 do content + 4 = 16
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  pressed: { opacity: 0.8 },
  joinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: theme.space[16],
    paddingRight: 12,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
});
