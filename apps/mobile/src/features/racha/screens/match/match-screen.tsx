import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  EmptyState,
  NoticeBanner,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_DISCARD,
  MATCH_FINISH,
  MATCH_LOAD_FAILED_TITLE,
  MATCH_LOADING,
  MATCH_NOT_ENOUGH_TEAMS,
  MATCH_TITLE,
  SORT_RETRY,
} from "../../utils/racha-messages";
import { MatchBetween } from "./match-between";
import { MatchClock } from "./match-clock";
import { MatchGoalList } from "./match-goal-list";
import { MatchHistory } from "./match-history";
import { MatchQueue } from "./match-queue";
import { MatchScoreboard } from "./match-scoreboard";
import { useMatchScreen } from "./use-match-screen";

export const MatchScreen = () => {
  const {
    isLoading,
    loadErrorText,
    isRetrying,
    retry,
    notices,
    open,
    ready,
    noNext,
    queue,
    history,
  } = useMatchScreen();

  return (
    <Screen title={MATCH_TITLE} canGoBack isScrollable={!open}>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel={MATCH_LOADING}
        />
      ) : loadErrorText ? (
        <EmptyState
          title={MATCH_LOAD_FAILED_TITLE}
          text={loadErrorText}
          actionLabel={SORT_RETRY}
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <View style={styles.body}>
          {notices.offline ? (
            <NoticeBanner tone="warning" text={notices.offline} isAlert />
          ) : null}
          {notices.conductorOffline ? (
            <NoticeBanner
              tone="warning"
              text={notices.conductorOffline}
              isAlert
            />
          ) : null}
          {notices.assumed ? (
            <Text preset="small" color="muted">
              {notices.assumed}
            </Text>
          ) : null}
          {open ? (
            <>
              <MatchClock {...open.clock} />
              <MatchScoreboard {...open.scoreboard} />
              {open.swapHome || open.swapAway ? (
                <View style={styles.swaps}>
                  {open.swapHome ? (
                    <Pressable
                      onPress={open.swapHome.onPress}
                      accessibilityRole="button"
                      accessibilityLabel={open.swapHome.label}
                      style={styles.swap}
                    >
                      <Text preset="small" color="action">
                        {open.swapHome.label}
                      </Text>
                    </Pressable>
                  ) : null}
                  {open.swapAway ? (
                    <Pressable
                      onPress={open.swapAway.onPress}
                      accessibilityRole="button"
                      accessibilityLabel={open.swapAway.label}
                      style={styles.swap}
                    >
                      <Text preset="small" color="action">
                        {open.swapAway.label}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <ScrollView
                style={styles.feed}
                contentContainerStyle={styles.feedContent}
                showsVerticalScrollIndicator={false}
              >
                <MatchGoalList goals={open.goals} />
              </ScrollView>
              {open.footer ? (
                <ScreenFooter>
                  <View style={styles.footer}>
                    <Button
                      title={MATCH_FINISH}
                      onPress={open.footer.onFinish}
                      isDisabled={open.footer.isDisabled}
                      style={styles.footerBtn}
                    />
                    <Button
                      title={MATCH_DISCARD}
                      preset="destructiveOutline"
                      onPress={open.footer.onDiscard}
                      isDisabled={open.footer.isDisabled}
                      style={styles.footerBtn}
                    />
                  </View>
                </ScreenFooter>
              ) : null}
            </>
          ) : (
            <>
              {ready ? <MatchBetween {...ready} /> : null}
              {noNext ? (
                <Text color="muted">{MATCH_NOT_ENOUGH_TEAMS}</Text>
              ) : null}
              <MatchQueue {...queue} />
              <MatchHistory matches={history} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, gap: theme.space[8] },
  swaps: { flexDirection: "row", gap: theme.space[8], marginBottom: 8 },
  swap: {
    flex: 1,
    minHeight: theme.minTouch,
    justifyContent: "center",
  },
  feed: { flex: 1 },
  feedContent: { paddingBottom: theme.space[16] },
  footer: { flexDirection: "row", gap: theme.space[8] },
  footerBtn: { flex: 1 },
});
