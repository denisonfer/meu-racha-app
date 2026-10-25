import { ScrollView, StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  NoticeBanner,
  OptionList,
  PlayerCardMini,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { TermHelp } from "../../components/term-help";
import {
  MATCH_REINFORCE_BACK,
  MATCH_REINFORCE_DRAW,
  MATCH_REINFORCE_PICK,
  MATCH_REINFORCE_PICK_BACK,
  MATCH_REINFORCE_PICK_CONFIRM,
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
    step,
    canPick,
    pickRows,
    pick,
    onPick,
    openPick,
    backToDonor,
    confirmPick,
    backToMatch,
    cancel,
  } = useMatchReinforcementScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={title}
      supporting={
        <View style={styles.supporting}>
          <Text color="muted" style={styles.shrink}>
            {supporting}
          </Text>
          {result || step === "pick" ? null : <TermHelp term="reinforcement" />}
        </View>
      }
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
      ) : step === "pick" ? (
        <View style={styles.body}>
          <ScrollView style={styles.list}>
            <OptionList
              options={pickRows.map((row) => ({
                value: row.value,
                title: row.title,
                description: row.description,
                leading: (
                  <PlayerCardMini
                    width={44}
                    overall={row.overall}
                    initials={row.initials}
                    photoUri={row.photoUrl}
                  />
                ),
              }))}
              value={pick ?? ""}
              onChange={onPick}
              isDisabled={isBusy}
            />
          </ScrollView>
          <NoticeBanner tone="warning" text={consequence} />
          {failureMessage ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {failureMessage}
            </Text>
          ) : null}
          <Button
            title={MATCH_REINFORCE_PICK_CONFIRM}
            onPress={confirmPick}
            isDisabled={isBusy || !pick}
            isLoading={isBusy}
          />
          <Button
            title={MATCH_REINFORCE_PICK_BACK}
            preset="outline"
            isDisabled={isBusy}
            onPress={backToDonor}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            <OptionList
              options={options}
              value={choice}
              onChange={onChoice}
              isDisabled={isBusy}
            />
          </ScrollView>
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
          {canPick ? (
            <Button
              title={MATCH_REINFORCE_PICK}
              preset="text"
              isDisabled={isBusy}
              onPress={openPick}
              style={styles.textButton}
            />
          ) : null}
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
  supporting: { flexDirection: "row", alignItems: "center", gap: 4 },
  shrink: { flexShrink: 1 },
  list: { maxHeight: 360 },
  // O preset text pinta o fundo da tela, mais escuro que a folha.
  textButton: { backgroundColor: "transparent" },
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
