import { Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { EventAttendanceCta } from "../../components/event-attendance-cta";
import { TAttendanceStatus } from "../../racha-types";

export type TEventCardAction = {
  kind: "assume" | "edit" | "cancel" | "finish";
  onPress: () => void;
};

type TEventCardProps = {
  kicker: string;
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
};

const ACTION_VIEW: Record<
  TEventCardAction["kind"],
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
  edit: { title: "Editar", preset: "secondary" },
  cancel: {
    title: "Cancelar",
    preset: "destructiveOutline",
    accessibilityHint: "Abre a confirmação",
  },
  finish: {
    title: "Encerrar",
    preset: "destructiveOutline",
    accessibilityHint: "Abre a confirmação",
  },
};

export const EventCard = ({
  kicker,
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
}: TEventCardProps) => (
  <View style={styles.card}>
    <Text preset="small" color="muted" style={styles.bold}>
      {kicker}
    </Text>
    <Text preset="stat" style={styles.when}>
      {when}
    </Text>
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
      const view = ACTION_VIEW[action.kind];
      return (
        <Button
          key={action.kind}
          title={view.title}
          preset={view.preset}
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
