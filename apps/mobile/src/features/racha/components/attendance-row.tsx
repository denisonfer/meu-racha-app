import { Pressable, StyleSheet, View } from "react-native";
import { Checkbox, Icon, PlayerCardMini, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export type TAttendanceRowAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

type TAttendanceRowProps = {
  name: string;
  initials: string;
  photoUrl: string | null;
  overall: number;
  /** Chip visual Mensalista/Avulso — semântica distinta de RoleChip. */
  chip: "monthly" | "guest" | null;
  positionText: string;
  paymentNote: string | null;
  queuePosition: number | null;
  stars: number | null;
  isSuperStar: boolean;
  isGoalkeeper: boolean;
  showChecks: boolean;
  didAttend: boolean;
  isPaid: boolean;
  showPaid: boolean;
  isPaidLocked: boolean;
  isAttendedDisabled: boolean;
  isPaidDisabled: boolean;
  isChecksBusy: boolean;
  onDidAttendChange?: (value: boolean) => void;
  onPaidChange?: (value: boolean) => void;
  /** Toque na carta + nome → detalhe do Membro (mesmas regras da lista de Membros). */
  onPress?: () => void;
  actions?: TAttendanceRowAction[];
  accessibilityLabel: string;
};

export const AttendanceRow = ({
  name,
  initials,
  photoUrl,
  overall,
  chip,
  positionText,
  paymentNote,
  queuePosition,
  stars,
  isSuperStar,
  isGoalkeeper,
  showChecks,
  didAttend,
  isPaid,
  showPaid,
  isPaidLocked,
  isAttendedDisabled,
  isPaidDisabled,
  isChecksBusy,
  onDidAttendChange,
  onPaidChange,
  onPress,
  actions,
  accessibilityLabel,
}: TAttendanceRowProps) => {
  const isQueue = queuePosition != null;
  const hasActions = (actions?.length ?? 0) > 0;

  const cardOrQueue = isQueue ? (
    <Text
      style={styles.queuePos}
      accessibilityLabel={`Posição ${queuePosition}`}
    >
      {queuePosition}
    </Text>
  ) : (
    <PlayerCardMini
      width={44}
      overall={overall}
      initials={initials}
      photoUri={photoUrl}
    />
  );

  const identity = (
    <View style={styles.info}>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {chip === "monthly" ? (
          <View style={[styles.chip, styles.chipMonthly]}>
            <Text
              preset="caption"
              style={[styles.chipLabel, styles.chipMonthlyLabel]}
            >
              MENSALISTA
            </Text>
          </View>
        ) : null}
        {chip === "guest" ? (
          <View style={[styles.chip, styles.chipGuest]}>
            <Text preset="caption" style={styles.chipLabel}>
              AVULSO
            </Text>
          </View>
        ) : null}
        <View style={styles.divider} />
        {isGoalkeeper ? (
          <Text style={styles.gol}>GOL</Text>
        ) : stars != null ? (
          <View
            style={styles.starsRow}
            accessibilityLabel={`${stars} estrelas`}
          >
            <Text style={styles.starsNumber}>{stars}</Text>
            <Icon name="star" size={18} color="action" fill="action" />
          </View>
        ) : null}
        {isSuperStar ? (
          <View style={styles.superChip}>
            <Text style={styles.superChipLabel}>SUPER</Text>
          </View>
        ) : null}
      </View>
      <Text
        preset="small"
        color="muted"
        style={styles.position}
        numberOfLines={1}
      >
        {positionText}
      </Text>
      {paymentNote ? (
        <Text
          preset="small"
          color="muted"
          numberOfLines={1}
          style={styles.note}
        >
          {paymentNote}
        </Text>
      ) : null}
    </View>
  );

  const identityPress = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Abre o detalhe do jogador"
      onPress={onPress}
      style={({ pressed }) => [styles.identityPress, pressed && styles.pressed]}
    >
      {cardOrQueue}
      {identity}
    </Pressable>
  ) : (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={styles.identityPress}
    >
      {cardOrQueue}
      {identity}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {identityPress}
        {showChecks ? (
          <View style={styles.checks}>
            <View style={styles.checkSlot}>
              <Checkbox
                label={null}
                accessibilityLabel="Veio"
                isChecked={didAttend}
                onChange={(value) => onDidAttendChange?.(value)}
                isDisabled={isAttendedDisabled || isChecksBusy}
              />
            </View>
            {showPaid ? (
              <View style={styles.checkSlot}>
                <Checkbox
                  label={null}
                  accessibilityLabel="Pagou"
                  isChecked={isPaid}
                  onChange={(value) => onPaidChange?.(value)}
                  isDisabled={isPaidDisabled || isPaidLocked || isChecksBusy}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {hasActions ? (
        <View style={styles.inlineActions}>
          {actions!.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={isChecksBusy}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              accessibilityState={{ disabled: isChecksBusy }}
              hitSlop={8}
            >
              <Text
                preset="small"
                color="action"
                style={[styles.actionLabel, isChecksBusy && styles.actionBusy]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  wrap: { paddingVertical: 10, paddingHorizontal: 10, gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
  },
  identityPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minWidth: 0,
  },
  queuePos: {
    ...theme.text.stat,
    color: theme.colors.action,
    fontSize: 27,
    lineHeight: 30,
    width: 24,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  name: {
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  position: { fontFamily: "Manrope-Bold", fontSize: 12, lineHeight: 16 },
  note: { fontSize: 11, lineHeight: 15 },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: theme.colors.divider,
    flexShrink: 0,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 0,
  },
  starsNumber: {
    ...theme.text.stat,
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  gol: {
    ...theme.text.stat,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  superChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: theme.radius.check,
    borderWidth: 1,
    borderColor: theme.colors.action,
    flexShrink: 0,
  },
  superChipLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: theme.colors.action,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingLeft: 53,
  },
  actionLabel: { fontFamily: "Manrope-Bold" },
  actionBusy: { opacity: 0.5 },
  chip: {
    justifyContent: "center",
    height: 22,
    paddingHorizontal: 6,
    borderRadius: theme.radius.check,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipMonthly: { borderColor: theme.colors.action },
  chipGuest: { borderColor: theme.colors.muted },
  chipLabel: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 10,
    letterSpacing: 0.45,
  },
  chipMonthlyLabel: {
    color: theme.colors.action,
  },
  checks: { flexDirection: "row", gap: 8, flexShrink: 0 },
  checkSlot: {
    width: 43,
    alignItems: "center",
    justifyContent: "center",
  },
});
