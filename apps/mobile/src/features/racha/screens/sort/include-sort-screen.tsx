import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SortPersonList } from "../../components/sort-person-list";
import {
  SORT_INCLUDE_BACK_TO_LIST,
  SORT_INCLUDE_GUEST,
  SORT_INCLUDE_MEMBERS,
  SORT_INCLUDE_NO_MEMBERS,
  SORT_INCLUDE_TITLE,
  SORT_LOAD_FAILED_TEXT,
} from "../../utils/racha-messages";
import { GuestForm } from "../attendance/guest-form";
import { useIncludeSortScreen } from "./use-include-sort-screen";

export const IncludeSortScreen = () => {
  const {
    isMissing,
    mode,
    isLoadingMembers,
    hasMembersError,
    memberRows,
    destination,
    failureMessage,
    guestForm,
    openGuest,
    backToList,
  } = useIncludeSortScreen();

  if (isMissing) return null;

  return (
    <BottomSheet title={SORT_INCLUDE_TITLE} isBusy={guestForm.isSaving}>
      {mode === "guest" ? (
        <View style={styles.guest}>
          <GuestForm {...guestForm} />
          <Button
            title={SORT_INCLUDE_BACK_TO_LIST}
            preset="outline"
            isDisabled={guestForm.isSaving}
            onPress={backToList}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {isLoadingMembers ? (
            <ActivityIndicator color={theme.colors.foreground} />
          ) : hasMembersError ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {SORT_LOAD_FAILED_TEXT}
            </Text>
          ) : memberRows.length === 0 ? (
            <Text color="muted">{SORT_INCLUDE_NO_MEMBERS}</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <SortPersonList
                title={SORT_INCLUDE_MEMBERS}
                hint={destination ?? undefined}
                rows={memberRows}
              />
            </ScrollView>
          )}
          {failureMessage ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {failureMessage}
            </Text>
          ) : null}
          <Button
            title={SORT_INCLUDE_GUEST}
            preset="secondary"
            onPress={openGuest}
          />
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  guest: { gap: theme.space[8] },
  list: { gap: theme.space[16] },
  scroll: { maxHeight: 360 },
});
