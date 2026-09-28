import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { Button } from "../button/button";
import { Text } from "../text/text";

export type TEmptyStateProps = {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
};

export const EmptyState = ({
  title,
  text,
  actionLabel,
  onAction,
  isLoading,
}: TEmptyStateProps) => (
  <View style={styles.box}>
    <Text preset="h3">{title}</Text>
    <Text preset="body" color="muted">
      {text}
    </Text>
    {actionLabel && onAction ? (
      <Button
        title={actionLabel}
        isLoading={isLoading}
        onPress={onAction}
        style={styles.action}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  box: {
    gap: theme.space[8],
    padding: theme.space[24],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.divider,
    borderRadius: theme.radius.card,
  },
  action: { marginTop: theme.space[8] },
});
