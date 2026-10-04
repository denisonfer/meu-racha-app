import { StyleSheet, View } from "react-native";
import { Button } from "../button/button";
import { Icon } from "../icon";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";

export type TNoticeBannerProps = {
  tone: "warning";
  text: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  // aviso com título que bloqueia uma ação: o leitor de tela anuncia sem foco
  isAlert?: boolean;
};

export const NoticeBanner = ({
  text,
  title,
  actionLabel,
  onAction,
  isAlert = false,
}: TNoticeBannerProps) => {
  if (!title) {
    return (
      <View style={styles.banner} accessibilityRole="alert">
        <Icon name="alert" color="warning" />
        <Text preset="small" style={styles.text}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerWithTitle]}>
      <Icon name="alert" color="warning" />
      <View style={styles.content}>
        {/* o botão fica fora do bloco de texto para ser focável sozinho */}
        <View
          style={styles.texts}
          accessible
          accessibilityRole={isAlert ? "alert" : "summary"}
          accessibilityLabel={`Aviso: ${title}. ${text}`}
        >
          <Text style={styles.title}>{title}</Text>
          <Text preset="small">{text}</Text>
        </View>
        {actionLabel && onAction ? (
          <Button
            title={actionLabel}
            preset="text"
            onPress={onAction}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningSurface,
  },
  text: {
    flex: 1,
    fontFamily: "Manrope-Bold",
  },
  bannerWithTitle: {
    alignItems: "flex-start",
    borderRadius: theme.radius.card,
  },
  content: { flex: 1, gap: theme.space[4] },
  texts: { gap: theme.space[4] },
  title: { fontFamily: "Manrope-Bold" },
  action: { alignSelf: "flex-end", minHeight: 44 },
});
