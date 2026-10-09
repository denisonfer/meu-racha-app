import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import { EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  NOTIFICATIONS_EMPTY,
  NOTIFICATIONS_EMPTY_TEXT,
  NOTIFICATIONS_LOAD_FAILED,
  NOTIFICATIONS_LOAD_FAILED_TEXT,
  NOTIFICATIONS_LOADING,
  NOTIFICATIONS_RETENTION,
  NOTIFICATIONS_RETRY,
  NOTIFICATIONS_TITLE,
} from "../../utils/notification-messages";
import { NotificationRow } from "./notification-row";
import { NotificationSectionHeader } from "./notification-section-header";
import { useNotificationsScreen } from "./use-notifications-screen";

export const NotificationsScreen = () => {
  const {
    sections,
    isLoading,
    isError,
    isEmpty,
    isRetrying,
    isRefreshing,
    retry,
    refresh,
  } = useNotificationsScreen();
  const lastKey = sections[sections.length - 1]?.key;

  return (
    <Screen title={NOTIFICATIONS_TITLE} hasTabBar>
      {isLoading ? (
        <View
          style={[styles.frame, styles.loading]}
          accessible
          accessibilityLabel={NOTIFICATIONS_LOADING}
        >
          <ActivityIndicator color={theme.colors.foreground} />
          <Text preset="small" color="muted" style={styles.loadingLabel}>
            {NOTIFICATIONS_LOADING}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.frame}>
          <EmptyState
            title={NOTIFICATIONS_LOAD_FAILED}
            text={NOTIFICATIONS_LOAD_FAILED_TEXT}
            actionLabel={NOTIFICATIONS_RETRY}
            onAction={retry}
            isLoading={isRetrying}
          />
        </View>
      ) : isEmpty ? (
        <View style={styles.frame}>
          <EmptyState
            title={NOTIFICATIONS_EMPTY}
            text={NOTIFICATIONS_EMPTY_TEXT}
          />
        </View>
      ) : (
        <SectionList
          style={styles.frame}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refresh()}
              tintColor={theme.colors.action}
              colors={[theme.colors.action]}
            />
          }
          renderSectionHeader={({ section }) => (
            <NotificationSectionHeader
              title={section.title}
              isNew={section.isNew}
            />
          )}
          renderSectionFooter={({ section }) =>
            section.key === lastKey ? null : <View style={styles.sectionGap} />
          }
          renderItem={({ item, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;
            return (
              <View
                style={[isFirst && styles.cardTop, isLast && styles.cardBottom]}
              >
                <NotificationRow
                  family={item.family}
                  text={item.text}
                  rachaName={item.rachaName}
                  when={item.when}
                  status={item.status}
                  isNew={item.isNew}
                  isUnavailable={item.isUnavailable}
                  isFirst={isFirst}
                  onPress={item.onPress}
                  accessibilityLabel={item.accessibilityLabel}
                />
              </View>
            );
          }}
          ListFooterComponent={
            <Text preset="small" color="muted" style={styles.footer}>
              {NOTIFICATIONS_RETENTION}
            </Text>
          }
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  // A Screen já reserva 16. O handoff pede 4 em cima, 20 nas laterais e 24 embaixo.
  frame: {
    flex: 1,
    marginTop: -12,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[8],
  },
  loadingLabel: { fontFamily: "Manrope-Bold" },
  cardTop: {
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    overflow: "hidden",
  },
  cardBottom: {
    borderBottomLeftRadius: theme.radius.card,
    borderBottomRightRadius: theme.radius.card,
    overflow: "hidden",
  },
  sectionGap: { height: 24 },
  footer: { marginTop: 24 },
});
