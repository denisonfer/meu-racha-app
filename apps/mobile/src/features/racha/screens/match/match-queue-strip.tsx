import { Pressable, StyleSheet } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MATCH_QUEUE_OPEN } from "../../utils/racha-messages";

type TMatchQueueStripProps = {
  text: string;
  isMine: boolean;
  onPress: () => void;
};

export const MatchQueueStrip = ({
  text,
  isMine,
  onPress,
}: TMatchQueueStripProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${text}. ${MATCH_QUEUE_OPEN}`}
    style={styles.strip}
  >
    <Text
      preset="small"
      color={isMine ? "action" : "foreground"}
      numberOfLines={1}
      style={styles.text}
    >
      {text}
    </Text>
    <Icon name="chevron-right" size={18} color="muted" />
  </Pressable>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  text: { flex: 1 },
});
