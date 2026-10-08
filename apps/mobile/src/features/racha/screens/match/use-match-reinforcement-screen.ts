import { initialsOf } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import { cardOverall, useRachaCards } from "../../hooks/use-racha-cards";
import {
  MATCH_REINFORCE_DRAW_TEAM,
  MATCH_REINFORCE_DRAW_TEAM_RESULT,
  MATCH_REINFORCE_DRAW_TEAM_TEXT,
  MATCH_REINFORCE_TITLE,
  matchFailureMessage,
  matchQueueOption,
  matchReinforceResult,
  matchReinforceSubtitle,
  matchTeamLeavesQueue,
  matchTeamLeftWith,
  sortTeamTitle,
} from "../../utils/racha-messages";

const DRAW = "draw";

type TReinforceResult = {
  title: string;
  supporting: string;
  name: string;
  fromTeam: number;
  toTeam: number;
  photoUrl: string | null;
};

export function useMatchReinforcementScreen() {
  const { id, eventId, teamId, profileId, guestId, name } =
    useLocalSearchParams<{
      id: string;
      eventId: string;
      teamId?: string;
      profileId?: string;
      guestId?: string;
      name?: string;
    }>();
  const matchQuery = useEventMatch(id, eventId);
  const cardsQuery = useRachaCards(id);
  const actions = useEventMatchActions(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [choice, setChoice] = useState<string>(DRAW);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TReinforceResult | null>(null);

  const portrait = matchQuery.data;
  const match = portrait?.match ?? null;
  const side =
    match && teamId
      ? match.home.teamId === teamId
        ? match.home
        : match.away.teamId === teamId
          ? match.away
          : null
      : null;
  const donors = portrait?.reinforcementDonors ?? [];
  const capacity = side?.capacity ?? match?.home.capacity ?? 0;
  const teamNumber = side?.teamNumber ?? 0;
  const displayName = name ?? "";
  const hasPerson = Boolean(profileId) !== Boolean(guestId);

  const consequenceOf = (donorTeamId: string | typeof DRAW) => {
    if (donorTeamId === DRAW) return MATCH_REINFORCE_DRAW_TEAM_RESULT;
    const donor = donors.find((item) => item.teamId === donorTeamId);
    if (!donor) return MATCH_REINFORCE_DRAW_TEAM_RESULT;
    if (donor.outfieldCount === 1)
      return matchTeamLeavesQueue(donor.teamNumber);
    return matchTeamLeftWith(
      donor.teamNumber,
      donor.outfieldCount - 1,
      capacity
    );
  };

  useEffect(() => {
    if (result) AccessibilityInfo.announceForAccessibility(result.title);
  }, [result]);

  const draw = async () => {
    if (!match || !hasPerson || isSaving) return;
    const snapshot = donors;
    setFailureMessage(null);
    setIsSaving(true);
    try {
      const next = await actions.reinforceEventMatch({
        matchId: match.id,
        profileId: profileId ?? null,
        guestId: guestId ?? null,
        donorTeamId: choice === DRAW ? null : choice,
      });
      const event = next.events[0];
      if (event?.kind !== "reinforcement") {
        router.dismissTo(`/racha/${id}/event/${eventId}/match`);
        return;
      }
      const donor = snapshot.find((item) => item.teamId === event.fromTeamId);
      const supporting =
        !donor || donor.outfieldCount === 1
          ? matchTeamLeavesQueue(event.fromTeamNumber)
          : matchTeamLeftWith(
              event.fromTeamNumber,
              donor.outfieldCount - 1,
              capacity
            );
      setResult({
        title: matchReinforceResult(
          event.entered.displayName,
          event.fromTeamNumber,
          event.toTeamNumber
        ),
        supporting,
        name: event.entered.displayName,
        fromTeam: event.fromTeamNumber,
        toTeam: event.toTeamNumber,
        photoUrl: event.entered.photoUrl,
      });
      setIsSaving(false);
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(matchFailureMessage(error), "danger");
        return;
      }
      setIsSaving(false);
      setFailureMessage(matchFailureMessage(error));
    }
  };

  return {
    isMissing:
      !match || !teamId || side == null || !hasPerson || name === undefined,
    result,
    title: result?.title ?? MATCH_REINFORCE_TITLE,
    supporting:
      result?.supporting ?? matchReinforceSubtitle(teamNumber, displayName),
    initials: result ? initialsOf(result.name) : "",
    photoUrl: result?.photoUrl ?? null,
    overall: cardOverall(cardsQuery.data, profileId || null),
    fromTo: result
      ? `${sortTeamTitle(result.fromTeam)} → ${sortTeamTitle(result.toTeam)}`
      : "",
    options: [
      {
        value: DRAW,
        title: MATCH_REINFORCE_DRAW_TEAM,
        description: MATCH_REINFORCE_DRAW_TEAM_TEXT,
      },
      ...donors.map((donor) => ({
        value: donor.teamId,
        title: sortTeamTitle(donor.teamNumber),
        description: matchQueueOption(
          donor.queuePosition,
          donor.outfieldCount,
          capacity,
          donor.outfieldCount < capacity
        ),
      })),
    ],
    choice,
    onChoice: setChoice,
    consequence: consequenceOf(choice),
    isBusy: isSaving,
    failureMessage,
    confirm: () => void draw(),
    backToMatch: () => router.dismissTo(`/racha/${id}/event/${eventId}/match`),
    cancel: close,
  };
}
