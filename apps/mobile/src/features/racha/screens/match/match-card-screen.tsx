import type { TMatchCardColor } from "@meu-racha/domain";
import { StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  NoticeBanner,
  OptionList,
  PenaltyCard,
  Text,
  type TOptionListOption,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { useMatchCardScreen } from "./use-match-card-screen";

export const MatchCardScreen = () => {
  const {
    isMissing,
    title,
    supporting,
    notice,
    yellowTitle,
    yellowText,
    redTitle,
    redText,
    note,
    choice,
    onChoice,
    primaryLabel,
    busyLabel,
    isBusy,
    failureMessage,
    confirm,
    cancel,
  } = useMatchCardScreen();

  if (isMissing) return null;

  const options: TOptionListOption<TMatchCardColor>[] = [
    {
      value: "yellow",
      title: yellowTitle,
      description: yellowText,
      leading: <PenaltyCard color="yellow" size="lg" />,
    },
    {
      value: "red",
      title: redTitle,
      description: redText,
      leading: <PenaltyCard color="red" size="lg" />,
    },
  ];

  return (
    <BottomSheet
      title={title}
      supporting={<Text color="muted">{supporting}</Text>}
      hasCloseButton={false}
      isBusy={isBusy}
    >
      <View style={styles.body}>
        {notice ? <NoticeBanner tone="warning" text={notice} /> : null}
        <OptionList
          options={options}
          value={choice}
          onChange={onChoice}
          isDisabled={isBusy}
        />
        <Text preset="small" color="muted">
          {note}
        </Text>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title={isBusy ? busyLabel : primaryLabel}
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { gap: theme.space[16] },
});
