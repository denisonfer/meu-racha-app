import type { TNotificationFamily } from "@meu-racha/domain";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import type { TIconName } from "@/ui/components/icon";
import { theme } from "@/ui/theme";
import { notificationsMeta } from "../../utils/notification-messages";

const FAMILY_ICON: Record<TNotificationFamily, TIconName> = {
  racha: "users",
  event: "calendar",
  team: "bolinhas",
  money: "ticket",
};

export type TNotificationRowStatus = {
  tone: "success" | "muted";
  icon: "check" | "close" | "ban";
  text: string;
};

export type TNotificationRowProps = {
  family: TNotificationFamily;
  text: string;
  rachaName: string;
  when: string;
  status?: TNotificationRowStatus;
  isNew: boolean;
  isUnavailable: boolean;
  isFirst: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
};

export const NotificationRow = ({
  family,
  text,
  rachaName,
  when,
  status,
  isNew,
  isUnavailable,
  isFirst,
  onPress,
  accessibilityLabel,
}: TNotificationRowProps) => {
  const sentenceColor = isUnavailable ? "muted" : "foreground";
  const content = (
    <>
      <View style={styles.iconBox}>
        <View style={[styles.iconCircle, isUnavailable && styles.iconDim]}>
          <Icon
            name={FAMILY_ICON[family]}
            size={20}
            color={isUnavailable ? "muted" : "foreground"}
          />
        </View>
        {isNew ? <View style={styles.newDot} /> : null}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} color={sentenceColor} style={styles.sentence}>
          {text}
        </Text>
        {status ? (
          <View style={styles.status}>
            <Icon name={status.icon} size={14} color={status.tone} />
            <Text color={status.tone} style={styles.statusText}>
              {status.text}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} color="muted" style={styles.meta}>
          {notificationsMeta(rachaName, when)}
        </Text>
      </View>
      {onPress ? (
        <View style={styles.chevron}>
          <Icon name="chevron-right" size={20} color="muted" />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.row, !isFirst && styles.divider]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 72,
    paddingTop: 14,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    backgroundColor: theme.colors.surface,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  pressed: { opacity: 0.7 },
  chevron: { alignSelf: "center" },
  iconBox: {
    width: 40,
    height: 40,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceRaised,
  },
  iconDim: { opacity: 0.6 },
  newDot: {
    position: "absolute",
    top: -2,
    right: -2,
    // A borda entra na caixa: 12 deixa 8 de lima e 2 de anel em cada lado.
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.action,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  copy: { flex: 1, gap: 2 },
  // Não há Manrope SemiBold carregada; o negrito do app é esta face.
  sentence: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    lineHeight: 22,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[4],
  },
  statusText: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
});
