import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  Chip,
  EmptyState,
  Screen,
  SegmentedControl,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { ResenhaCard } from "../racha-home/resenha-card";
import {
  SEASON_EMPTY_TEXT,
  SEASON_EVENTS_EMPTY,
  SEASON_EVENTS_EMPTY_TEXT,
  SEASON_EVENTS_LOAD_FAILED,
  SEASON_LOAD_FAILED,
  SEASON_LOADING,
  SEASON_TAB_EVENTS,
  SEASON_TAB_RANKING,
  SORT_LOAD_FAILED_TEXT,
  SORT_RETRY,
} from "../../utils/racha-messages";
import { RankingList } from "./ranking-list";
import { RankingRow } from "./ranking-row";
import { useSeasonScreen } from "./use-season-screen";

export const SeasonScreen = () => {
  const {
    title,
    tab,
    onChangeTab,
    list,
    onChangeList,
    listOptions,
    rankingCaption,
    rankingEmptyTitle,
    rankingRows,
    pinnedRow,
    rankingStatus,
    rankingRetry,
    rankingRetrying,
    eventCards,
    eventsStatus,
    eventsRetry,
    eventsRetrying,
  } = useSeasonScreen();

  return (
    <Screen canGoBack title={title}>
      <View style={styles.body}>
        <SegmentedControl
          options={[
            { value: "ranking", label: SEASON_TAB_RANKING },
            { value: "events", label: SEASON_TAB_EVENTS },
          ]}
          value={tab}
          onChange={onChangeTab}
          accessibilityLabel="Temporada"
        />

        {tab === "ranking" ? (
          <View style={styles.pane}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {listOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  isSelected={option.value === list}
                  isFullWidth
                  onPress={() => onChangeList(option.value)}
                />
              ))}
            </View>

            {rankingStatus === "loading" ? (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.colors.foreground} />
                <Text preset="small" color="muted" style={styles.loadingText}>
                  {SEASON_LOADING}
                </Text>
              </View>
            ) : rankingStatus === "error" ? (
              <EmptyState
                title={SEASON_LOAD_FAILED}
                text={SORT_LOAD_FAILED_TEXT}
                actionLabel={SORT_RETRY}
                onAction={rankingRetry}
                isLoading={rankingRetrying}
              />
            ) : rankingStatus === "empty" ? (
              <EmptyState title={rankingEmptyTitle} text={SEASON_EMPTY_TEXT} />
            ) : (
              <View style={styles.listPane}>
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <RankingList rows={rankingRows} caption={rankingCaption} />
                </ScrollView>
                {pinnedRow ? (
                  <View style={styles.pinned}>
                    <RankingRow variant="pinned" {...pinnedRow} />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : eventsStatus === "loading" ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.foreground} />
          </View>
        ) : eventsStatus === "error" ? (
          <EmptyState
            title={SEASON_EVENTS_LOAD_FAILED}
            text={SORT_LOAD_FAILED_TEXT}
            actionLabel={SORT_RETRY}
            onAction={eventsRetry}
            isLoading={eventsRetrying}
          />
        ) : eventsStatus === "empty" ? (
          <EmptyState
            title={SEASON_EVENTS_EMPTY}
            text={SEASON_EVENTS_EMPTY_TEXT}
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.events}
            showsVerticalScrollIndicator={false}
          >
            {eventCards.map((card) => (
              <ResenhaCard key={card.eventId} {...card} />
            ))}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, gap: theme.space[16] },
  pane: { flex: 1, gap: theme.space[16] },
  listPane: { flex: 1 },
  chips: {
    flexDirection: "row",
    gap: theme.space[8],
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[8],
  },
  loadingText: { fontFamily: "Manrope-Bold" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: theme.space[8] },
  pinned: { marginTop: theme.space[8] },
  events: { gap: theme.space[8], paddingBottom: theme.space[8] },
});
