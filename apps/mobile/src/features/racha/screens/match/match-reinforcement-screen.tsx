import { StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  NoticeBanner,
  OptionList,
  PlayerCardMini,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  MATCH_REINFORCE_BACK,
  MATCH_REINFORCE_DRAW,
} from "../../utils/racha-messages";
import { useMatchReinforcementScreen } from "./use-match-reinforcement-screen";

export const MatchReinforcementScreen = () => {
  const {
    isMissing,
    result,
    title,
    supporting,
    initials,
    photoUrl,
    overall,
    fromTo,
    options,
    choice,
    onChoice,
    consequence,
    isBusy,
    failureMessage,
    confirm,
    backToMatch,
    cancel,
  } = useMatchReinforcementScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={<Text color="muted">{supporting}</Text>}
      hasCloseButton={false}
      isBusy={isBusy}
    >
      {result ? (
        <View style={styles.body}>
          <View style={styles.card}>
            <PlayerCardMini
              width={52}
              overall={overall}
              initials={initials}
              photoUri={photoUrl}
            />
            <View style={styles.cardTexts}>
              <Text preset="h3">{result.name}</Text>
              <Text preset="small" color="muted">
                {fromTo}
              </Text>
            </View>
          </View>
          <Button title={MATCH_REINFORCE_BACK} onPress={backToMatch} />
        </View>
      ) : (
        <View style={styles.body}>
          <OptionList
            options={options}
            value={choice}
            onChange={onChoice}
            isDisabled={isBusy}
          />
          <NoticeBanner tone="warning" text={consequence} />
          {failureMessage ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {failureMessage}
            </Text>
          ) : null}
          <Button
            title={MATCH_REINFORCE_DRAW}
            onPress={confirm}
            isDisabled={isBusy}
            isLoading={isBusy}
          />
          <Button
            title="Cancelar"
            preset="outline"
            isDisabled={isBusy}
            onPress={cancel}
          />
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: theme.space[16] },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  cardTexts: { flex: 1, gap: 2 },
});
