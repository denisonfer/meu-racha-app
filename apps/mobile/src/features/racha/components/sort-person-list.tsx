import { initialsOf } from "@meu-racha/domain";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, PlayerCardMini, Text } from "@/ui/components";
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
  action: TSortRowAction | null;
};

type TSortPersonListProps = {
  title: string;
  hint?: string;
  rows: TSortPersonListRow[];
};

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
              {row.detail ? (
                <Text preset="caption" color="muted" style={styles.detail}>
                  {row.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
          {row.action ? (
            <Pressable
              onPress={row.action.onPress}
              disabled={row.action.isDisabled}
              accessibilityRole="button"
              accessibilityLabel={row.action.accessibilityLabel}
              accessibilityState={{ disabled: row.action.isDisabled }}
              style={[styles.action, row.action.isDisabled && styles.busy]}
            >
              {row.action.icon ? (
                <Icon name={row.action.icon} size={22} color="errorText" />
              ) : (
                <Text preset="small" color="action" style={styles.actionLabel}>
                  {row.action.label}
                </Text>
              )}
            </Pressable>
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
  detail: { fontFamily: "Manrope-Bold" },
  action: {
    minHeight: theme.minTouch,
    minWidth: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionLabel: { fontFamily: "Manrope-Bold" },
  busy: { opacity: 0.5 },
});
