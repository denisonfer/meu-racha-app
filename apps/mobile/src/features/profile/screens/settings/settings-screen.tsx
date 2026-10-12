import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Icon, NoticeBanner, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  DELETE_ACCOUNT,
  DELETE_ACCOUNT_HINT,
  PUSH_DENIED_SETTINGS_TEXT,
  PUSH_DENIED_TITLE,
  PUSH_OPEN_SETTINGS,
  PUSH_ROW_LABEL,
  PUSH_ROW_OFF,
  PUSH_ROW_ON,
  PUSH_UNASKED_ACTION,
  PUSH_UNASKED_TEXT,
  PUSH_UNASKED_TITLE,
  SETTINGS_ABOUT,
  SETTINGS_ACCOUNT,
  SETTINGS_NOTIFICATIONS,
  SETTINGS_PRIVACY,
  SETTINGS_TERMS,
  SETTINGS_TITLE,
  settingsVersion,
} from "../../utils/settings-messages";
import { useSettingsScreen } from "./use-settings-screen";

export const SettingsScreen = () => {
  const {
    pushEnabled,
    isPushLoading,
    togglePush,
    banner,
    openSettings,
    askPermission,
    openTerms,
    openPrivacy,
    openDeleteAccount,
    version,
  } = useSettingsScreen();
  const pushText = pushEnabled ? PUSH_ROW_ON : PUSH_ROW_OFF;

  return (
    <Screen canGoBack title={SETTINGS_TITLE} isScrollable>
      <View style={styles.content}>
        <View>
          <Text color="muted" style={styles.sectionTitle}>
            {SETTINGS_NOTIFICATIONS}
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.pushTexts}>
                <Text style={styles.label}>{PUSH_ROW_LABEL}</Text>
                <Text preset="small" color="muted">
                  {pushText}
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={togglePush}
                disabled={isPushLoading}
                accessibilityLabel={PUSH_ROW_LABEL}
                accessibilityHint={pushText}
                trackColor={{
                  false: theme.colors.mutedDisabled,
                  true: theme.colors.action,
                }}
                thumbColor={
                  pushEnabled ? theme.colors.onAction : theme.colors.muted
                }
                ios_backgroundColor={theme.colors.mutedDisabled}
              />
            </View>
          </View>
          {banner === "denied" ? (
            <View style={styles.banner}>
              <NoticeBanner
                tone="warning"
                title={PUSH_DENIED_TITLE}
                text={PUSH_DENIED_SETTINGS_TEXT}
                actionLabel={PUSH_OPEN_SETTINGS}
                onAction={openSettings}
              />
            </View>
          ) : banner === "unasked" ? (
            <View style={styles.banner}>
              <NoticeBanner
                tone="warning"
                title={PUSH_UNASKED_TITLE}
                text={PUSH_UNASKED_TEXT}
                actionLabel={PUSH_UNASKED_ACTION}
                onAction={askPermission}
              />
            </View>
          ) : null}
        </View>

        <View>
          <Text color="muted" style={styles.sectionTitle}>
            {SETTINGS_ABOUT}
          </Text>
          <View style={styles.card}>
            <Pressable
              onPress={openTerms}
              accessibilityRole="link"
              accessibilityLabel={SETTINGS_TERMS}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.grow, styles.label]}>{SETTINGS_TERMS}</Text>
              <Icon name="chevron-right" color="muted" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              onPress={openPrivacy}
              accessibilityRole="link"
              accessibilityLabel={SETTINGS_PRIVACY}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.grow, styles.label]}>
                {SETTINGS_PRIVACY}
              </Text>
              <Icon name="chevron-right" color="muted" />
            </Pressable>
          </View>
        </View>

        <View>
          <Text color="muted" style={styles.sectionTitle}>
            {SETTINGS_ACCOUNT}
          </Text>
          <View style={styles.card}>
            <Pressable
              onPress={openDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel={DELETE_ACCOUNT}
              accessibilityHint={DELETE_ACCOUNT_HINT}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text color="errorText" style={styles.label}>
                {DELETE_ACCOUNT}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text preset="small" color="muted" style={styles.version}>
          {settingsVersion(version)}
        </Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { gap: theme.space[24] },
  sectionTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
    marginBottom: theme.space[8],
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
    paddingVertical: 12,
    paddingLeft: theme.space[16],
    paddingRight: 12,
  },
  pushTexts: { flex: 1, gap: 2 },
  grow: { flex: 1 },
  label: { fontFamily: "Manrope-Bold" },
  pressed: { opacity: 0.8 },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  banner: { marginTop: 12 },
  version: { textAlign: "center" },
});
