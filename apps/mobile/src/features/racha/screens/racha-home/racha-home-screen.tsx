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
import { RulesSummary } from "../../components/rules-summary";
import {
  CONDUCTOR_CANNOT_LEAVE,
  OWNER_HINT_TO_LEAVE,
} from "../../utils/racha-messages";
import { EventCard } from "./event-card";
import { InviteCard } from "./invite-card";
import { ResenhaCard } from "./resenha-card";
import { useRachaHomeScreen } from "./use-racha-home-screen";

export const RachaHomeScreen = () => {
  const {
    racha,
    isLoading,
    retry,
    isRetrying,
    shareInvite,
    backToRachas,
    openRequests,
    openMembers,
    openSettings,
    openLogistics,
    eventCard,
    resenhaCard,
    seasonRow,
    selfPositionNotice,
    showEmptyEvent,
    showCreateEvent,
    eventsMissing,
    canLeave,
    showConductorCannotLeave,
    openLeave,
    openCreateEvent,
  } = useRachaHomeScreen();

  return (
    <Screen
      canGoBack
      onGoBack={backToRachas}
      isScrollable
      headerRight={
        racha?.isOwner ? (
          <Pressable
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Configurações do racha"
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="settings" size={24} />
          </Pressable>
        ) : undefined
      }
    >
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
        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text preset="h1" style={styles.extraBold}>
              {racha.name}
            </Text>
          </View>

          {racha.pendingRow ? (
            <Pressable
              onPress={openRequests}
              accessibilityRole="button"
              accessibilityLabel={racha.pendingRow.label}
              style={({ pressed }) => [
                styles.pendingRow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.pendingCount}>{racha.pendingRow.count}</Text>
              <View style={styles.grow}>
                <Text style={styles.bold}>{racha.pendingRow.word}</Text>
                <Text preset="small">Aprove ou recuse quem pediu.</Text>
              </View>
              <Icon name="chevron-right" />
            </Pressable>
          ) : null}

          {eventsMissing ? (
            <EmptyState
              title="Não deu pra abrir o evento"
              text="Confira a internet e tente de novo."
              actionLabel="Tentar de novo"
              onAction={retry}
              isLoading={isRetrying}
            />
          ) : eventCard ? (
            <View style={styles.eventBlock}>
              {selfPositionNotice ? (
                <NoticeBanner tone="warning" isAlert {...selfPositionNotice} />
              ) : null}
              <EventCard {...eventCard} />
              {showCreateEvent ? (
                <Button
                  title="Criar evento"
                  preset="secondary"
                  onPress={openCreateEvent}
                />
              ) : null}
            </View>
          ) : showEmptyEvent ? (
            <View style={styles.nextEventCard}>
              <View style={styles.emptyCopy}>
                <Text preset="small" color="muted" style={styles.bold}>
                  Próximo evento
                </Text>
                <Text style={styles.bold}>Nenhum evento marcado</Text>
                <Text preset="small" color="muted">
                  {showCreateEvent
                    ? "Defina dia, hora e local do próximo jogo."
                    : "Quando o dono marcar o próximo jogo, ele aparece aqui."}
                </Text>
              </View>
              {showCreateEvent ? (
                <Button
                  title="Criar evento"
                  preset="secondary"
                  onPress={openCreateEvent}
                />
              ) : null}
            </View>
          ) : null}

          {resenhaCard ? <ResenhaCard {...resenhaCard} /> : null}

          {racha.isOwner ? (
            <InviteCard code={racha.inviteCode} onShare={shareInvite} />
          ) : null}

          <View style={styles.groupCard}>
            <Pressable
              onPress={openMembers}
              accessibilityRole="button"
              accessibilityLabel={`Membros, ${racha.memberCount}`}
              style={({ pressed }) => [
                styles.membersRow,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="users" color="muted" size={22} />
              <Text style={[styles.grow, styles.membersLabel]}>
                Membros <Text color="muted">· </Text>
                <Text style={styles.membersCount}>{racha.memberCount}</Text>
              </Text>
              <Icon name="chevron-right" color="muted" />
            </Pressable>

            {seasonRow ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={seasonRow.onOpen}
                  accessibilityRole="button"
                  accessibilityLabel={seasonRow.accessibilityLabel}
                  style={({ pressed }) => [
                    styles.membersRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="trophy" color="muted" size={22} />
                  <Text
                    style={[styles.grow, styles.membersLabel]}
                    numberOfLines={1}
                  >
                    {seasonRow.title}
                  </Text>
                  <Text
                    preset="small"
                    color="muted"
                    numberOfLines={1}
                    style={styles.seasonRight}
                  >
                    {seasonRow.right}
                  </Text>
                  <Icon name="chevron-right" color="muted" />
                </Pressable>
              </>
            ) : null}

            <View style={styles.divider} />

            {racha.isOwner ? (
              <Pressable
                onPress={openSettings}
                accessibilityRole="button"
                accessibilityLabel={`Regras do jogo: ${racha.summary.join(", ")}`}
                accessibilityHint="Abre as configurações do racha"
                style={({ pressed }) => [
                  styles.rulesRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rulesTexts}>
                  <Text preset="small" color="muted" style={styles.bold}>
                    Regras do jogo
                  </Text>
                  <RulesSummary parts={racha.summary} />
                </View>
                <Icon name="chevron-right" color="muted" />
              </Pressable>
            ) : (
              <View
                style={styles.rules}
                accessible
                accessibilityLabel={`Regras do jogo: ${racha.summary.join(", ")}`}
              >
                <Text preset="small" color="muted" style={styles.bold}>
                  Regras do jogo
                </Text>
                <RulesSummary parts={racha.summary} />
              </View>
            )}

            {racha.isOwnerOrAdmin ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={openLogistics}
                  accessibilityRole="button"
                  accessibilityLabel={`Logística, ${racha.place}`}
                  style={({ pressed }) => [
                    styles.rulesRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rulesTexts}>
                    <Text preset="small" color="muted" style={styles.bold}>
                      Logística
                    </Text>
                    <Text style={styles.bold}>{racha.place}</Text>
                  </View>
                  <Icon name="chevron-right" color="muted" />
                </Pressable>
              </>
            ) : null}
          </View>

          {canLeave ? (
            <View style={styles.leaveZone}>
              <Button
                preset="destructiveOutline"
                title="Deixar o racha"
                accessibilityHint="Abre a confirmação"
                onPress={openLeave}
                style={styles.leaveButton}
              />
            </View>
          ) : racha.isOwner ? (
            <View style={styles.leaveZone}>
              <Text preset="small" color="muted">
                {OWNER_HINT_TO_LEAVE}
              </Text>
            </View>
          ) : showConductorCannotLeave ? (
            <View style={styles.leaveZone}>
              <Text preset="small" color="muted">
                {CONDUCTOR_CANNOT_LEAVE}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 20 },
  titleBlock: { gap: theme.space[8] },
  extraBold: { fontFamily: "Manrope-ExtraBold" },
  bold: { fontFamily: "Manrope-Bold" },

  grow: { flex: 1 },
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    width: theme.minTouch,
    height: theme.minTouch,
    marginVertical: -10,
    marginRight: -10,
  },
  pressed: { opacity: 0.8 },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceRaised,
  },
  pendingCount: {
    ...theme.text.stat,
    minWidth: 24,
    fontSize: 34,
    lineHeight: 34,
    color: theme.colors.action,
    fontVariant: ["tabular-nums"],
  },
  groupCard: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  membersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  membersLabel: { fontFamily: "Manrope-Bold" },
  membersCount: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  seasonRight: {
    flexShrink: 1,
    fontFamily: "Manrope-Bold",
  },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  rules: {
    gap: theme.space[4],
    paddingTop: 14,
    paddingBottom: theme.space[16],
    paddingHorizontal: theme.space[16],
  },
  rulesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingTop: 14,
    paddingBottom: theme.space[16],
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  rulesTexts: { flex: 1, gap: theme.space[4] },
  eventBlock: { gap: 12 },
  nextEventCard: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  emptyCopy: { gap: 2 },
  leaveZone: {
    paddingTop: theme.space[32],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  leaveButton: { minHeight: 48 },
});
