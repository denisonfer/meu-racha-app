import { ActivityIndicator } from "react-native";
import { EmptyState, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SortPrepareView } from "../../components/sort-prepare-view";
import { SortProposalView } from "../../components/sort-proposal-view";
import { SortPublishedView } from "../../components/sort-published-view";
import {
  SORT_LOADING,
  SORT_LOAD_FAILED_TITLE,
  SORT_NOT_READY_TEXT,
  SORT_NOT_READY_TITLE,
  SORT_RETRY,
} from "../../utils/racha-messages";
import { useSortScreen } from "./use-sort-screen";

/** Uma rota, três estados: o banco decide entre preparar, proposta e Times publicados. */
export const SortScreen = () => {
  const {
    title,
    isLoading,
    loadErrorText,
    isRetrying,
    retry,
    prepare,
    proposal,
    published,
    notReadyText,
  } = useSortScreen();

  return (
    <Screen title={title} canGoBack>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel={SORT_LOADING}
        />
      ) : loadErrorText ? (
        <EmptyState
          title={SORT_LOAD_FAILED_TITLE}
          text={loadErrorText}
          actionLabel={SORT_RETRY}
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : published ? (
        <SortPublishedView {...published} />
      ) : proposal ? (
        <SortProposalView {...proposal} />
      ) : prepare ? (
        <SortPrepareView {...prepare} />
      ) : (
        <EmptyState
          title={SORT_NOT_READY_TITLE}
          text={notReadyText ?? SORT_NOT_READY_TEXT}
        />
      )}
    </Screen>
  );
};
