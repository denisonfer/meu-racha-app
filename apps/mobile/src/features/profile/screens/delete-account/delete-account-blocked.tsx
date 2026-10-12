import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import type { TAccountDeletionCheck } from "../../profile-types";
import {
  DELETE_ACCOUNT_BLOCKED_TEXT,
  DELETE_ACCOUNT_BLOCKED_TITLE,
  DELETE_ACCOUNT_CONDUCTOR_HINT,
  DELETE_ACCOUNT_CONDUCTOR_TITLE,
  DELETE_ACCOUNT_OWNER_HINT,
  deleteAccountMemberCount,
  deleteAccountOwnerTitle,
} from "../../utils/settings-messages";

type TDeleteAccountBlockedProps = {
  ownedRachas: TAccountDeletionCheck["ownedRachas"];
  conducting: TAccountDeletionCheck["conducting"];
  onOpenRacha: (rachaId: string) => void;
  onOpenEvent: (rachaId: string, eventId: string) => void;
};

type TRow = { key: string; name: string; meta?: string; onPress: () => void };

export const DeleteAccountBlocked = ({
  ownedRachas,
  conducting,
  onOpenRacha,
  onOpenEvent,
}: TDeleteAccountBlockedProps) => {
  const groups = [
    ownedRachas.length > 0 && {
      title: deleteAccountOwnerTitle(ownedRachas.length),
      hint: DELETE_ACCOUNT_OWNER_HINT,
      rows: ownedRachas.map<TRow>((r) => ({
        key: r.id,
        name: r.name,
        meta: deleteAccountMemberCount(r.memberCount),
        onPress: () => onOpenRacha(r.id),
      })),
    },
    conducting.length > 0 && {
      title: DELETE_ACCOUNT_CONDUCTOR_TITLE,
      hint: DELETE_ACCOUNT_CONDUCTOR_HINT,
      rows: conducting.map<TRow>((c) => ({
        key: c.eventId,
        name: c.rachaName,
        onPress: () => onOpenEvent(c.rachaId, c.eventId),
      })),
    },
  ].filter((group) => group !== false);

  return (
    <BottomSheet
      title={DELETE_ACCOUNT_BLOCKED_TITLE}
      supporting={<Text>{DELETE_ACCOUNT_BLOCKED_TEXT}</Text>}
    >
      <View style={styles.groups}>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <View style={styles.groupTexts}>
              <Text accessibilityRole="header" style={styles.groupTitle}>
                {group.title}
              </Text>
              <Text preset="small">{group.hint}</Text>
            </View>
            <View style={styles.card}>
              {group.rows.map((row, index) => (
                <Fragment key={row.key}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    onPress={row.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={
                      row.meta ? `${row.name}, ${row.meta}` : row.name
                    }
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.grow}>
                      <Text style={styles.name}>{row.name}</Text>
                      {row.meta ? (
                        <Text preset="small" color="muted">
                          {row.meta}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" color="muted" />
                  </Pressable>
                </Fragment>
              ))}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  groups: { gap: 20 },
  group: { gap: theme.space[8] },
  groupTexts: { gap: 2 },
  groupTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  grow: { flex: 1 },
  name: { fontFamily: "Manrope-Bold" },
  pressed: { opacity: 0.8 },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
});
