import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Icon, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { JoinRequestCard } from "../../components/join-request-card";
import { RoleChip } from "../../components/role-chip";
import { TMemberRole } from "../../racha-types";
import { useRachasScreen } from "./use-rachas-screen";

export const RachasScreen = () => {
  const {
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

type TRachaCardProps = {
  name: string;
  role: TMemberRole;
  membersLabel: string;
  pendingLabel: string | null;
  accessibilityLabel: string;
  canCreateEvent: boolean;
  onPress: () => void;
};

// Só a variante sem Evento: a do próximo Evento chega com a fatia 5
const RachaCard = ({
  name,
  role,
  membersLabel,
  pendingLabel,
  accessibilityLabel,
  canCreateEvent,
  onPress,
}: TRachaCardProps) => (
  <View style={styles.card}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
    >
      <View style={[styles.grow, styles.cardTexts]}>
        {pendingLabel ? (
          <View style={styles.badge}>
            <Icon name="user-plus" size={16} color="onAction" />
            <Text style={styles.badgeLabel}>{pendingLabel}</Text>
          </View>
        ) : null}
        <Text preset="h3">{name}</Text>
        <View style={styles.roleRow}>
          <RoleChip role={role} />
          <Text preset="small" color="muted">
            {membersLabel}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" color="muted" />
    </Pressable>

    <View style={styles.cardBottom}>
      <View style={styles.cardNoEvent}>
        <Text style={styles.bold}>Nenhum evento marcado</Text>
        <Text preset="small" color="muted">
          {canCreateEvent
            ? "Marque o próximo jogo para a galera confirmar presença."
            : "Quando o dono marcar o próximo jogo, ele aparece aqui."}
        </Text>
      </View>
      {/* sem destino: criar evento é a fatia 5 */}
      {canCreateEvent ? (
        <Button title="Criar primeiro evento" onPress={() => {}} />
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: theme.space[16],
  },
  title: { flex: 1, fontFamily: "Manrope-ExtraBold" },
  content: { gap: 12 },
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  pressed: { opacity: 0.8 },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingTop: theme.space[16],
    paddingBottom: 14,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  cardTexts: { gap: 8, alignItems: "flex-start" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingLeft: theme.space[8],
    paddingRight: 10,
    borderRadius: theme.radius.check,
    backgroundColor: theme.colors.action,
  },
  badgeLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: theme.colors.onAction,
  },
  roleRow: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  cardBottom: {
    gap: 12,
    marginHorizontal: theme.space[16],
    paddingTop: 14,
    paddingBottom: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  cardNoEvent: { gap: 2 },
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
