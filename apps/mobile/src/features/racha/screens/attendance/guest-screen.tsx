import { StyleSheet, View } from "react-native";
import { Screen } from "@/ui/components";
import { TermHelp } from "../../components/term-help";
import { GuestForm } from "./guest-form";
import { useGuestScreen } from "./use-guest-screen";

export const GuestScreen = () => {
  const {
    isMissing,
    values,
    errors,
    asksPositionDetail,
    failureMessage,
    isSaving,
    canSubmit,
    onChange,
    onSubmit,
  } = useGuestScreen();

  if (isMissing) return null;

  return (
    <Screen
      title="Adicionar avulso"
      canGoBack
      headerRight={
        <View style={styles.headerRight}>
          <TermHelp term="guest" />
        </View>
      }
    >
      <GuestForm
        values={values}
        errors={errors}
        asksPositionDetail={asksPositionDetail}
        failureMessage={failureMessage}
        isSaving={isSaving}
        canSubmit={canSubmit}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRight: { marginVertical: -10, marginRight: -10 },
});
