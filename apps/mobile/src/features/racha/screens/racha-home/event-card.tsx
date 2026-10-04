import { Pressable, StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MatchLiveTag } from "../../components/match-live-tag";
import { TeamsDefinedTag } from "../../components/teams-defined-tag";
import { EventAttendanceCta } from "../../components/event-attendance-cta";
import { TAttendanceStatus } from "../../racha-types";
import {
  MATCH_VIEW,
  SORT_PREPARE,
  SORT_VIEW_TEAMS,
} from "../../utils/racha-messages";

export type TEventCardAction = {
  kind:
    | "assume"
    | "edit"
    | "cancel"
    | "finish"
    | "prepareSort"
    | "viewSort"
    | "viewMatch";
  onPress: () => void;
  isLoading?: boolean;
};

type TEventCardProps = {
  kicker: string;
  isTeamsDefined: boolean;
  when: string;
  place: string;
  isPaid: boolean;
  price: string | null;
  monthlyPrice: string | null;
  spotLimit: number | null;
  conductorLine: string | null;
  confirmedCount: number;
  myStatus: TAttendanceStatus | null;
  myQueuePosition: number | null;
  onOpenAttendance: () => void;
  actions: TEventCardAction[];
  upcoming: {
    when: string;
    conductorLine: string | null;
    onEdit?: () => void;
    onCancel?: () => void;
  } | null;
  isMatchLive: boolean;
};

// Só Editar vira ícone no topo do cartão; Cancelar e Encerrar ficam como botões
const ICON_ACTION_VIEW = {
  edit: { icon: "edit", label: "Editar evento", color: "foreground" },
} as const;

type TIconKind = keyof typeof ICON_ACTION_VIEW;

const ACTION_VIEW: Record<
  Exclude<TEventCardAction["kind"], TIconKind>,
  {
    title: string;
    preset: "primary" | "secondary" | "destructiveOutline";
    accessibilityHint?: string;
  }
> = {
  assume: {
    title: "Assumir condução",
    preset: "primary",
    accessibilityHint: "Abre a confirmação",
  },
  cancel: {
    title: "Cancelar evento",
    preset: "destructiveOutline",
    accessibilityHint: "Abre a confirmação",
  },
  finish: {
    title: "Encerrar evento",
    preset: "destructiveOutline",
    accessibilityHint: "Abre a confirmação",
  },
  prepareSort: {
    title: SORT_PREPARE,
    preset: "secondary",
  },
  viewSort: {
    title: SORT_VIEW_TEAMS,
    preset: "secondary",
  },
  viewMatch: {
    title: MATCH_VIEW,
    preset: "secondary",
  },
};

export const EventCard = ({
  kicker,
  isTeamsDefined,
  when,
  place,
  isPaid,
  price,
  monthlyPrice,
  spotLimit,
  conductorLine,
  confirmedCount,
  myStatus,
  myQueuePosition,
  onOpenAttendance,
  actions,
  upcoming,
  isMatchLive,
}: TEventCardProps) => (
  <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.headerText}>
        {isMatchLive ? (
          <MatchLiveTag />
        ) : isTeamsDefined ? (
          <TeamsDefinedTag />
        ) : (
          <Text preset="small" color="muted" style={styles.bold}>
            {kicker}
          </Text>
        )}
        <Text preset="stat" style={styles.when}>
          {when}
        </Text>
      </View>
      <View style={styles.iconActions}>
        {actions.map((action) => {
          if (!(action.kind in ICON_ACTION_VIEW)) return null;
          const view = ICON_ACTION_VIEW[action.kind as TIconKind];
          return (
            <IconButton
              key={action.kind}
              icon={view.icon}
              color={view.color}
              accessibilityLabel={view.label}
              isLoading={action.isLoading}
              onPress={action.onPress}
            />
          );
        })}
      </View>
    </View>
    <Text style={styles.bold}>{place}</Text>
    {price || monthlyPrice ? (
      <View style={styles.facts}>
        {price ? (
          <View style={styles.amount}>
            {isPaid ? (
              <Text preset="small" color="muted" style={styles.bold}>
                Diária
              </Text>
            ) : null}
            <Text preset="stat" color="action" style={styles.price}>
              {price}
            </Text>
          </View>
        ) : null}
        {monthlyPrice ? (
          <View style={styles.amount}>
            <Text preset="small" color="muted" style={styles.bold}>
              Mensal
            </Text>
            <Text preset="stat" color="action" style={styles.monthlyPrice}>
              {monthlyPrice}
            </Text>
          </View>
        ) : null}
      </View>
    ) : null}
    {conductorLine ? (
      <Text preset="small" color="muted">
        {conductorLine}
      </Text>
    ) : null}
    <EventAttendanceCta
      confirmedCount={confirmedCount}
      spotLimit={spotLimit}
      myStatus={myStatus}
      myQueuePosition={myQueuePosition}
      onOpenAttendance={onOpenAttendance}
    />
    {actions.map((action) => {
      if (action.kind in ICON_ACTION_VIEW) return null;
      const view = ACTION_VIEW[action.kind as keyof typeof ACTION_VIEW];
      return (
        <Button
          key={action.kind}
          title={view.title}
          preset={view.preset}
          isLoading={action.isLoading}
          onPress={action.onPress}
          accessibilityLabel={view.title}
          accessibilityHint={view.accessibilityHint}
        />
      );
    })}
    {upcoming ? (
      <View style={styles.upcoming}>
        <Text preset="small" color="muted">
          Próximo agendado · {upcoming.when}
        </Text>
        {upcoming.conductorLine ? (
          <Text preset="small" color="muted">
            {upcoming.conductorLine}
          </Text>
        ) : null}
        {upcoming.onEdit || upcoming.onCancel ? (
          <View style={styles.upcomingActions}>
            {upcoming.onEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar próximo evento agendado"
                onPress={upcoming.onEdit}
                style={styles.upcomingAction}
              >
                <Text preset="small" color="action" style={styles.bold}>
                  Editar
                </Text>
              </Pressable>
            ) : null}
            {upcoming.onCancel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar próximo evento agendado"
                accessibilityHint="Abre a confirmação"
                onPress={upcoming.onCancel}
                style={styles.upcomingAction}
              >
                <Text preset="small" color="errorText" style={styles.bold}>
                  Cancelar
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  bold: { fontFamily: "Manrope-Bold" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  // o ícone de 44 px sobra do cartão em vez de empurrar o título para baixo
  iconActions: { flexDirection: "row", margin: -8 },
  when: { fontSize: 32, lineHeight: 32 },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 12,
  },
  amount: { gap: 2 },
  price: {
    fontSize: 40,
    lineHeight: 40,
    fontVariant: ["tabular-nums"],
  },
  monthlyPrice: {
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  upcoming: {
    gap: 4,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
    paddingTop: 12,
  },
  upcomingActions: { flexDirection: "row", gap: 12 },
  upcomingAction: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});
