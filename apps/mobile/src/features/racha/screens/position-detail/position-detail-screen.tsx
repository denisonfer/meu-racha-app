import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { PositionDetailSlots } from "../../components/position-detail-slots";
import {
  POSITION_DETAIL_MEMBER_HINT,
  POSITION_DETAIL_SECTION,
  POSITION_DETAIL_SHEET_TEXT,
  POSITION_DETAIL_SHEET_TITLE,
  SORT_LOAD_FAILED_TEXT,
  SORT_RETRY,
} from "../../utils/racha-messages";
import { usePositionDetailScreen } from "./use-position-detail-screen";

export const PositionDetailScreen = () => {
  const {
    isMissing,
    isSelf,
    isLoading,
    isError,
    rachaName,
    memberName,
    slots,
    values,
    errors,
    onChange,
    failureMessage,
    isSaving,
    onSubmit,
    retry,
  } = usePositionDetailScreen();

  if (isMissing) return null;

  const owner = isSelf ? rachaName : memberName;
  const text = isSelf
    ? POSITION_DETAIL_SHEET_TEXT
    : POSITION_DETAIL_MEMBER_HINT;

  return (
    <BottomSheet
      title={isSelf ? POSITION_DETAIL_SHEET_TITLE : POSITION_DETAIL_SECTION}
      supporting={
        <Text preset="small" color="muted">
          {owner ? `${owner} · ${text}` : text}
        </Text>
      }
      isBusy={isSaving}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : isError ? (
        <View style={styles.footer}>
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {SORT_LOAD_FAILED_TEXT}
          </Text>
          <Button title={SORT_RETRY} preset="outline" onPress={retry} />
        </View>
      ) : (
        <>
          <PositionDetailSlots
            slots={slots}
            values={values}
            errors={errors}
            onChange={onChange}
            isDisabled={isSaving}
          />
          <View style={styles.footer}>
            {failureMessage ? (
              <Text preset="small" color="errorText" accessibilityRole="alert">
                {failureMessage}
              </Text>
            ) : null}
            <Button
              title="Salvar"
              accessibilityLabel={isSaving ? "Salvando" : "Salvar"}
              isLoading={isSaving}
              onPress={onSubmit}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  footer: { gap: 10, paddingTop: theme.space[8] },
});
