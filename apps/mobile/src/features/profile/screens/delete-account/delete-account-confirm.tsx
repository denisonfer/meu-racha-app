import { StyleSheet, View } from "react-native";
import { ConfirmBottomSheet, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  DELETE_ACCOUNT_BUSY,
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_KEEP,
  DELETE_ACCOUNT_KEEP_STATS,
  DELETE_ACCOUNT_LOSE,
  DELETE_ACCOUNT_LOSE_ACCESS,
  DELETE_ACCOUNT_LOSE_PHOTO,
  DELETE_ACCOUNT_TEXT,
  DELETE_ACCOUNT_TITLE,
} from "../../utils/settings-messages";

type TDeleteAccountConfirmProps = {
  loseRachas: string | null;
  isBusy: boolean;
  failureMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export const DeleteAccountConfirm = ({
  loseRachas,
  isBusy,
  failureMessage,
  onConfirm,
  onCancel,
}: TDeleteAccountConfirmProps) => {
  const lose = [DELETE_ACCOUNT_LOSE_ACCESS, DELETE_ACCOUNT_LOSE_PHOTO];
  if (loseRachas) lose.push(loseRachas);

  return (
    <ConfirmBottomSheet
      title={DELETE_ACCOUNT_TITLE}
      message={DELETE_ACCOUNT_TEXT}
      confirmLabel={DELETE_ACCOUNT_CONFIRM}
      busyLabel={DELETE_ACCOUNT_BUSY}
      isBusy={isBusy}
      failureMessage={failureMessage}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <View style={styles.lists}>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{DELETE_ACCOUNT_LOSE}</Text>
          {lose.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.icon}>
                <Icon name="close" size={18} strokeWidth={2.5} />
              </View>
              <Text style={styles.grow}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{DELETE_ACCOUNT_KEEP}</Text>
          <View style={styles.item}>
            <View style={styles.icon}>
              <Icon name="check" size={18} strokeWidth={2.5} />
            </View>
            <Text style={styles.grow}>{DELETE_ACCOUNT_KEEP_STATS}</Text>
          </View>
        </View>
      </View>
    </ConfirmBottomSheet>
  );
};

const styles = StyleSheet.create({
  lists: { gap: theme.space[16] },
  group: { gap: theme.space[8] },
  groupTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  // centraliza o ícone de 18 na primeira linha de 24
  icon: { marginTop: 3 },
  grow: { flex: 1 },
});
