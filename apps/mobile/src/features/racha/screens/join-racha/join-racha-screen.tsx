import { PropsWithChildren } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Icon,
  Screen,
  ScreenFooter,
  Text,
  TIconName,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { JoinPositionSection } from "./join-position-section";
import { useJoinRachaScreen } from "./use-join-racha-screen";

export const JoinRachaScreen = () => {
  const {
    isLoading,
    isGone,
    invite,
    retry,
    isRetrying,
    backToRachas,
    goBack,
    request,
    isRequesting,
    positionSection,
    canRequest,
    cancel,
    isCancelling,
  } = useJoinRachaScreen();

  if (isLoading || isGone || !invite) {
    return (
      <Screen title="Convite" canGoBack onGoBack={goBack}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.foreground} />
        ) : isGone ? (
          <EmptyState
            title="Este convite não vale mais"
            text="Peça um convite novo a quem te chamou."
            actionLabel="Voltar para Rachas"
            onAction={backToRachas}
          />
        ) : (
          <EmptyState
            title="Não deu pra abrir o convite"
            text="Confira a internet e tente de novo."
            actionLabel="Tentar de novo"
            onAction={retry}
            isLoading={isRetrying}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Convite" canGoBack onGoBack={goBack}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text preset="small" color="muted" style={styles.bold}>
            Convite para o racha
          </Text>
          <Text preset="h1" style={styles.extraBold}>
            {invite.name}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="user">
            <Text style={styles.bold}>
              <Text color="muted" style={styles.bold}>
                Dono:{" "}
              </Text>
              {invite.ownerName}
            </Text>
          </InfoRow>
          <InfoRow icon="users" hasDivider>
            <Text style={styles.number}>{invite.memberCount}</Text>
            <Text style={styles.bold}>{invite.memberWord}</Text>
          </InfoRow>
          {invite.minAge !== null ? (
            <InfoRow icon="calendar" hasDivider>
              <Text style={styles.bold}>A partir de</Text>
              <Text style={styles.number}>{invite.minAge}</Text>
              <Text style={styles.bold}>anos</Text>
            </InfoRow>
          ) : null}
        </View>

        {invite.status === "PENDING" ? (
          <View style={[styles.statusCard, styles.pendingCard]}>
            <Icon name="clock" size={24} />
            <View style={styles.statusTexts}>
              <Text preset="h3">Aguardando aprovação</Text>
              <Text preset="small">
                Você entra quando o dono ou um admin aprovar.
              </Text>
            </View>
          </View>
        ) : null}

        {positionSection ? <JoinPositionSection {...positionSection} /> : null}
      </ScrollView>

      {invite.status === null ? (
        <ScreenFooter>
          <Text preset="small" color="muted">
            O dono ou um admin do racha aprova o seu pedido.
          </Text>
          <Button
            title="Solicitar entrada"
            accessibilityLabel={
              isRequesting ? "Enviando pedido" : "Solicitar entrada"
            }
            isLoading={isRequesting}
            isDisabled={!canRequest}
            onPress={request}
          />
        </ScreenFooter>
      ) : invite.status === "PENDING" ? (
        <ScreenFooter>
          <Button
            title="Cancelar pedido"
            preset="secondary"
            accessibilityLabel={isCancelling ? "Cancelando" : "Cancelar pedido"}
            isLoading={isCancelling}
            onPress={cancel}
          />
        </ScreenFooter>
      ) : null}
    </Screen>
  );
};

type TInfoRowProps = PropsWithChildren & {
  icon: TIconName;
  hasDivider?: boolean;
};

const InfoRow = ({ icon, hasDivider = false, children }: TInfoRowProps) => (
  <View style={[styles.infoRow, hasDivider && styles.infoRowDivider]}>
    <Icon name={icon} size={22} color="muted" />
    <View style={styles.infoValue}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 20, paddingBottom: theme.space[24] },
  titleBlock: { gap: 6 },
  bold: { fontFamily: "Manrope-Bold" },
  extraBold: { fontFamily: "Manrope-ExtraBold" },
  infoCard: {
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
  },
  infoRowDivider: { borderTopWidth: 1, borderColor: theme.colors.divider },
  infoValue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  number: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
  },
  pendingCard: { backgroundColor: theme.colors.surfaceRaised },
  statusTexts: { flex: 1, gap: theme.space[4] },
});
