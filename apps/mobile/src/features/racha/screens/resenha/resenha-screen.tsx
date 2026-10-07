import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  RESENHA,
  RESENHA_GENERATING,
  RESENHA_LOAD_FAILED_TITLE,
  RESENHA_NO_MATCH,
  RESENHA_NO_MATCH_TEXT,
  RESENHA_SHARE,
  SORT_RETRY,
} from "../../utils/racha-messages";
import { ResenhaCardList } from "./resenha-card-list";
import { ResenhaHighlights } from "./resenha-highlights";
import { ResenhaPoster } from "./resenha-poster";
import { useResenhaScreen } from "./use-resenha-screen";

export const ResenhaScreen = () => {
  const {
    isLoading,
    loadErrorText,
    isRetrying,
    retry,
    isEmpty,
    header,
    highlights,
    cards,
    poster,
    posterRef,
    isGenerating,
    onShare,
  } = useResenhaScreen();

  return (
    <Screen title={RESENHA} canGoBack>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : loadErrorText ? (
        <EmptyState
          title={RESENHA_LOAD_FAILED_TITLE}
          text={loadErrorText}
          actionLabel={SORT_RETRY}
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : isEmpty ? (
        <View style={styles.body}>
          {header ? <ResenhaHeader {...header} /> : null}
          <EmptyState title={RESENHA_NO_MATCH} text={RESENHA_NO_MATCH_TEXT} />
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {header ? <ResenhaHeader {...header} /> : null}
            {highlights ? <ResenhaHighlights {...highlights} /> : null}
            <ResenhaCardList cards={cards} />
          </ScrollView>
          <ScreenFooter>
            <Button
              title={isGenerating ? RESENHA_GENERATING : RESENHA_SHARE}
              icon="share"
              isLoading={isGenerating}
              onPress={onShare}
              accessibilityLabel={
                isGenerating ? "Gerando imagem" : RESENHA_SHARE
              }
            />
          </ScreenFooter>
          {poster ? (
            <View
              ref={posterRef}
              collapsable={false}
              pointerEvents="none"
              style={styles.offscreen}
            >
              <ResenhaPoster {...poster} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
};

const ResenhaHeader = ({
  weekday,
  dayMonth,
  placeLine,
}: {
  weekday: string;
  dayMonth: string;
  placeLine: string;
}) => (
  <View style={styles.header}>
    <Text preset="small" color="muted" style={styles.bold}>
      {weekday}
    </Text>
    <Text style={styles.date}>{dayMonth}</Text>
    <Text color="muted">{placeLine}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 24, paddingBottom: 24 },
  body: { gap: 24 },
  header: { gap: 4 },
  bold: { fontFamily: "Manrope-Bold" },
  date: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 40,
    lineHeight: 40,
    color: theme.colors.foreground,
  },
  offscreen: {
    position: "absolute",
    left: -2000,
    top: 0,
    width: 432,
    height: 540,
  },
});
