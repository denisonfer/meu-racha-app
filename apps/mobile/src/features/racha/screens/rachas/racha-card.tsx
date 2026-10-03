import { Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { EventAttendanceCta } from "../../components/event-attendance-cta";
import { TeamsDefinedTag } from "../../components/teams-defined-tag";
import { RoleChip } from "../../components/role-chip";
import { TAttendanceStatus, TMemberRole } from "../../racha-types";
import { SORT_VIEW_TEAMS } from "../../utils/racha-messages";

type TRachaCardEvent = {
  kicker: string;
  isTeamsDefined: boolean;
  when: string;
  place: string;
  confirmedCount: number;
  spotLimit: number | null;
  myStatus: TAttendanceStatus | null;
  myQueuePosition: number | null;
  onOpenAttendance: () => void;
  // Times publicados: só existe com Sorteio confirmado
  onOpenSort: (() => void) | null;
};

type TRachaCardProps = {
  name: string;
  role: TMemberRole;
  membersLabel: string;
  pendingLabel: string | null;
  accessibilityLabel: string;
  canCreateEvent: boolean;
  event: TRachaCardEvent | null;
  onPress: () => void;
  onCreateEvent: () => void;
};

export const RachaCard = ({
  name,
  role,
  membersLabel,
  pendingLabel,
  accessibilityLabel,
  canCreateEvent,
  event,
  onPress,
  onCreateEvent,
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
      {event ? (
        <View style={styles.cardEvent}>
          <View style={styles.eventMeta}>
            {event.isTeamsDefined ? (
              <TeamsDefinedTag />
            ) : (
              <Text preset="small" color="muted" style={styles.bold}>
                {event.kicker}
              </Text>
            )}
            <Text style={styles.bold}>{event.when}</Text>
            <Text preset="small" color="muted">
              {event.place}
            </Text>
          </View>
          <EventAttendanceCta
            confirmedCount={event.confirmedCount}
            spotLimit={event.spotLimit}
            myStatus={event.myStatus}
            myQueuePosition={event.myQueuePosition}
            onOpenAttendance={event.onOpenAttendance}
          />
          {event.onOpenSort ? (
            <Button
              title={SORT_VIEW_TEAMS}
              preset="secondary"
              onPress={event.onOpenSort}
              accessibilityLabel={SORT_VIEW_TEAMS}
              accessibilityHint="Abre os times do sorteio"
            />
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.cardNoEvent}>
            <Text style={styles.bold}>Nenhum evento marcado</Text>
            <Text preset="small" color="muted">
              {canCreateEvent
                ? "Defina dia, hora e local do próximo jogo."
                : "Quando um evento for marcado, ele aparece aqui."}
            </Text>
          </View>
          {canCreateEvent ? (
            <Button title="Criar evento" onPress={onCreateEvent} />
          ) : null}
        </>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
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
  cardEvent: { gap: 12 },
  eventMeta: { gap: 4 },
});
