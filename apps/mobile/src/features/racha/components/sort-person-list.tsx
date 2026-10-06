import { initialsOf } from "@meu-racha/domain";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, PenaltyCard, PlayerCardMini, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import type { TSortRowAction } from "./sort-team-card";

export type TSortPersonListRow = {
  key: string;
  name: string;
  photoUrl: string | null;
  overall: number;
  detail: string;
  accessibilityLabel: string;
  // troca de Goleiros: o toque na linha escolhe quem vai trocar
  isSelected: boolean;
  onPress: (() => void) | null;
  actions: TSortRowAction[];
  isDimmed?: boolean;
  statusMark?: "yellow" | "red" | null;
};

type TSortPersonListProps = {
  title: string;
  hint?: string;
  rows: TSortPersonListRow[];
};

const RowAction = ({ action }: { action: TSortRowAction }) => (
  <Pressable
    onPress={action.onPress}
    disabled={action.isDisabled}
    accessibilityRole="button"
    accessibilityLabel={action.accessibilityLabel}
    accessibilityState={{ disabled: action.isDisabled }}
    style={[
      styles.action,
      action.caption ? styles.captionAction : null,
      action.isDisabled && styles.busy,
    ]}
  >
    {action.icon ? (
      <Icon
        name={action.icon}
        size={22}
        color={action.caption ? "muted" : "errorText"}
      />
    ) : (
      <Text preset="small" color="action" style={styles.actionLabel}>
        {action.label}
      </Text>
    )}
    {action.caption ? (
      <Text color="muted" style={styles.caption}>
        {action.caption}
      </Text>
    ) : null}
  </Pressable>
);

/** Lista de pessoas do Sorteio fora dos cartões: Goleiros, fila do gol, Aguardando inclusão e Saíram. */
export const SortPersonList = ({ title, hint, rows }: TSortPersonListProps) => (
  <View style={styles.section}>
    <Text preset="h3" accessibilityRole="header">
      {title}
    </Text>
    {hint ? (
      <Text preset="small" color="muted">
        {hint}
      </Text>
    ) : null}
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[
            styles.row,
            index > 0 && styles.divider,
            row.isSelected && styles.selected,
            row.isDimmed && styles.dimmed,
          ]}
        >
          <Pressable
            onPress={row.onPress ?? undefined}
            disabled={row.onPress === null}
            accessible
            accessibilityRole={row.onPress ? "button" : undefined}
            accessibilityLabel={row.accessibilityLabel}
            accessibilityState={
              row.onPress ? { selected: row.isSelected } : undefined
            }
            style={styles.identity}
          >
            <PlayerCardMini
              width={44}
              overall={row.overall}
              initials={initialsOf(row.name)}
              photoUri={row.photoUrl}
            />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {row.name}
              </Text>
              {row.detail || row.statusMark ? (
                <View style={styles.detailRow}>
                  {row.statusMark ? (
                    <PenaltyCard color={row.statusMark} size="xs" />
                  ) : null}
                  {row.detail ? (
                    <Text
                      preset="caption"
                      color={row.statusMark ? "foreground" : "muted"}
                      style={styles.detail}
                    >
                      {row.detail}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>
          {row.actions.length > 0 ? (
            <View style={styles.actions}>
              {row.actions.map((action) => (
                <RowAction key={action.accessibilityLabel} action={action} />
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  section: { gap: theme.space[8] },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 8,
  },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  selected: { backgroundColor: theme.colors.surfaceRaised },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: theme.minTouch,
    minWidth: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: "Manrope-Bold", fontSize: 15, lineHeight: 20 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detail: { fontFamily: "Manrope-Bold", flexShrink: 1 },
  dimmed: { opacity: 0.55 },
  actions: { flexDirection: "row", alignItems: "center" },
  action: {
    minHeight: theme.minTouch,
    minWidth: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionLabel: { fontFamily: "Manrope-Bold" },
  captionAction: {
    minWidth: 48,
    minHeight: 48,
    flexDirection: "column",
    paddingHorizontal: 0,
  },
  caption: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    lineHeight: 12,
  },
  busy: { opacity: 0.5 },
});
