import { ActivityIndicator } from "react-native";
import { Button, NoticeBanner, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SortPage } from "../../components/sort-page";
import {
  BOLINHAS,
  BOLINHAS_BACK_TO_TEAMS,
  BOLINHAS_CHANGED_TEXT,
  BOLINHAS_CHANGED_TITLE,
  BOLINHAS_NOT_CONDUCTOR_NO_NAME,
  BOLINHAS_DRAW,
  BOLINHAS_FAILED_TEXT,
  BOLINHAS_FAILED_TITLE,
  BOLINHAS_GIVER,
  BOLINHAS_HELP,
  BOLINHAS_MOVE,
  BOLINHAS_NOT_CONDUCTOR_TITLE,
  BOLINHAS_PICK_GIVER_FIRST,
  BOLINHAS_RECEIVER,
  BOLINHAS_RETRY,
  bolinhasNotConductorText,
} from "../../utils/racha-messages";
import { BolinhasSummary } from "./bolinhas-summary";
import { BolinhasTeamList } from "./bolinhas-team-list";
import { BolinhasUnavailable } from "./bolinhas-unavailable";
import { useBolinhasScreen } from "./use-bolinhas-screen";

type TBolinhasError = ReturnType<typeof useBolinhasScreen>["error"];

const errorTitle = (error: NonNullable<TBolinhasError>) =>
  error.kind === "conduction"
    ? BOLINHAS_NOT_CONDUCTOR_TITLE
    : error.kind === "changed"
      ? BOLINHAS_CHANGED_TITLE
      : BOLINHAS_FAILED_TITLE;

const errorText = (error: NonNullable<TBolinhasError>) =>
  error.kind === "network"
    ? BOLINHAS_FAILED_TEXT
    : error.kind === "changed"
      ? BOLINHAS_CHANGED_TEXT
      : error.kind === "other"
        ? error.message
        : error.conductorName
          ? bolinhasNotConductorText(error.conductorName)
          : BOLINHAS_NOT_CONDUCTOR_NO_NAME;

/** M1–M4 e R3: o Condutor escolhe quem cede e quem recebe. */
export const BolinhasScreen = () => {
  const s = useBolinhasScreen();

  if (s.isLoading) {
    return (
      <Screen title={BOLINHAS} canGoBack>
        <ActivityIndicator color={theme.colors.foreground} />
      </Screen>
    );
  }
  if (s.availability !== "ok" && !s.isBusy) {
    return (
      <Screen title={BOLINHAS} canGoBack>
        <BolinhasUnavailable reason={s.availability} onBack={s.goBack} />
      </Screen>
    );
  }

  const primaryLabel =
    s.error?.kind === "conduction"
      ? BOLINHAS_BACK_TO_TEAMS
      : s.error?.kind === "network"
        ? BOLINHAS_RETRY
        : s.summary?.allMove
          ? BOLINHAS_MOVE
          : BOLINHAS_DRAW;

  return (
    <Screen title={BOLINHAS} canGoBack>
      <SortPage
        footer={
          <>
            {s.summary ? <BolinhasSummary {...s.summary} /> : null}
            <Button
              title={primaryLabel}
              isDisabled={s.primary.isDisabled}
              onPress={s.primary.onPress}
              isLoading={s.isBusy}
            />
          </>
        }
      >
        <Text preset="small" color="muted">
          {BOLINHAS_HELP}
        </Text>
        {s.error ? (
          <NoticeBanner
            tone="warning"
            isAlert
            title={errorTitle(s.error)}
            text={errorText(s.error)}
          />
        ) : null}
        <BolinhasTeamList
          title={BOLINHAS_GIVER}
          rows={s.giverRows}
          onChange={s.hasGiver ? s.onChangeGiver : undefined}
        />
        <BolinhasTeamList
          title={BOLINHAS_RECEIVER}
          rows={s.receiverRows}
          isMuted={!s.hasGiver}
          helper={s.hasGiver ? undefined : BOLINHAS_PICK_GIVER_FIRST}
        />
      </SortPage>
    </Screen>
  );
};
