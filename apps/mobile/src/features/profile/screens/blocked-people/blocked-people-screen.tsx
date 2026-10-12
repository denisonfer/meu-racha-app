import { Fragment } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  BLOCKED_EMPTY,
  BLOCKED_EMPTY_TEXT,
  BLOCKED_LOAD_FAILED,
  BLOCKED_LOAD_FAILED_TEXT,
  BLOCKED_PEOPLE,
  BLOCKED_PEOPLE_TEXT,
  BLOCKED_RETRY,
} from "../../utils/settings-messages";
import { BlockedPersonRow } from "./blocked-person-row";
import { useBlockedPeopleScreen } from "./use-blocked-people-screen";

export const BlockedPeopleScreen = () => {
  const { isLoading, isError, retry, isRetrying, isEmpty, people } =
    useBlockedPeopleScreen();

  return (
    <Screen title={BLOCKED_PEOPLE} canGoBack isScrollable>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : isError ? (
        <EmptyState
          title={BLOCKED_LOAD_FAILED}
          text={BLOCKED_LOAD_FAILED_TEXT}
          actionLabel={BLOCKED_RETRY}
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : isEmpty ? (
        <EmptyState title={BLOCKED_EMPTY} text={BLOCKED_EMPTY_TEXT} />
      ) : (
        <View style={styles.content}>
          <Text preset="small" color="muted">
            {BLOCKED_PEOPLE_TEXT}
          </Text>
          <View style={styles.card}>
            {people.map(({ key, ...person }, index) => (
              <Fragment key={key}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <BlockedPersonRow {...person} />
              </Fragment>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { gap: theme.space[16] },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
});
