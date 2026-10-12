import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, BottomSheet, Icon, Text, TIconName } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  ACTION_BLOCK,
  ACTION_REPORT,
  ACTION_UNBLOCK,
  ACTION_UNBLOCK_HINT,
  actionBlockHint,
} from "../../utils/moderation-messages";
import { useMemberActionsSheet } from "./use-member-actions-sheet";

export const MemberActionsSheetScreen = () => {
  const { member, rachaName, openReport, openBlock, unblock } =
    useMemberActionsSheet();

  if (!member) return null;

  return (
    <BottomSheet
      title={member.name}
      leading={
        <Avatar
          name={member.name}
          photoUrl={member.photoUrl}
          size={48}
          backgroundColor="surface"
        />
      }
      supporting={
        rachaName ? (
          <Text preset="small" color="muted">
            {rachaName}
          </Text>
        ) : null
      }
    >
      <View style={styles.card}>
        <ActionRow icon="flag" title={ACTION_REPORT} onPress={openReport} />
        <View style={styles.divider} />
        {member.isBlocked ? (
          <ActionRow
            icon="ban"
            title={ACTION_UNBLOCK}
            hint={ACTION_UNBLOCK_HINT}
            onPress={unblock}
          />
        ) : (
          <ActionRow
            icon="ban"
            title={ACTION_BLOCK}
            hint={actionBlockHint(member.firstName)}
            onPress={openBlock}
          />
        )}
      </View>
    </BottomSheet>
  );
};

type TActionRowProps = {
  icon: TIconName;
  title: string;
  hint?: string;
  onPress: () => void;
};

const ActionRow = ({ icon, title, hint, onPress }: TActionRowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint={hint}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
  >
    <Icon name={icon} size={22} />
    <View style={styles.texts}>
      <Text style={styles.title}>{title}</Text>
      {hint ? (
        <Text preset="small" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: theme.space[16],
  },
  pressed: { opacity: 0.8 },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: "Manrope-Bold" },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
});
