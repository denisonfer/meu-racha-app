import { initialsOf, roleBadge, type TMatchPerson } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import { cardOverall, useRachaCards } from "../../hooks/use-racha-cards";
import {
  MATCH_REINFORCE_DRAW_TEAM,
  MATCH_REINFORCE_DRAW_TEAM_RESULT,
  MATCH_REINFORCE_DRAW_TEAM_TEXT,
  MATCH_INVALID_DONOR,
  MATCH_REINFORCE_PICK_TITLE,
  MATCH_REINFORCE_TITLE,
  matchFailureMessage,
  matchQueueOption,
  matchReinforcePickGone,
  matchReinforcePickSubtitle,
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
  profileId: string | null;
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
  const [step, setStep] = useState<"donor" | "pick">("donor");
  const [pick, setPick] = useState<string | null>(null);

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
  const donor =
    choice === DRAW
      ? null
      : (donors.find((item) => item.teamId === choice) ?? null);
  const canPick = (donor?.outfieldCount ?? 0) > 1;
  const pickRows = [...(donor?.outfield ?? [])]
    .sort((a, b) =>
      a.person.displayName.localeCompare(b.person.displayName, "pt-BR")
    )
    .map(({ person, primaryPosition }) => ({
      value: person.personId,
      title: person.displayName,
      description: roleBadge("OUTFIELD", primaryPosition) ?? undefined,
      profileId: person.profileId,
      initials: initialsOf(person.displayName),
      photoUrl: person.photoUrl,
      overall: cardOverall(cardsQuery.data, person.profileId),
    }));
  const title =
    result?.title ??
    (step === "pick" ? MATCH_REINFORCE_PICK_TITLE : MATCH_REINFORCE_TITLE);

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

  // Só a troca de passo é anunciada; a abertura da folha já lê o título.
  const announcedStep = useRef(step);
  useEffect(() => {
    if (announcedStep.current === step) return;
    announcedStep.current = step;
    AccessibilityInfo.announceForAccessibility(title);
  }, [step, title]);

  const draw = async (entering?: TMatchPerson) => {
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
        enteringProfileId: entering?.profileId ?? null,
        enteringGuestId: entering?.guestId ?? null,
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
        profileId: event.entered.profileId,
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
      if (
        entering &&
        error instanceof Error &&
        error.message === "entering_not_active"
      ) {
        const teamNumberBefore = donor?.teamNumber ?? 0;
        setPick(null);
        const refreshed = await matchQuery.refetch();
        const fresh = refreshed.data?.reinforcementDonors.find(
          (item) => item.teamId === choice
        );
        if (!fresh || fresh.outfieldCount === 0) {
          setStep("donor");
          setChoice(DRAW);
          setFailureMessage(MATCH_INVALID_DONOR);
        } else {
          setFailureMessage(
            matchReinforcePickGone(entering.displayName, teamNumberBefore)
          );
        }
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
      setFailureMessage(matchFailureMessage(error));
    }
  };

  const resetPick = (next: "donor" | "pick") => {
    setStep(next);
    setPick(null);
    setFailureMessage(null);
  };

  return {
    isMissing:
      !match || !teamId || side == null || !hasPerson || name === undefined,
    result,
    step,
    title,
    supporting:
      result?.supporting ??
      (step === "pick"
        ? matchReinforcePickSubtitle(
            donor?.teamNumber ?? 0,
            teamNumber,
            displayName
          )
        : matchReinforceSubtitle(teamNumber, displayName)),
    initials: result ? initialsOf(result.name) : "",
    photoUrl: result?.photoUrl ?? null,
    overall: cardOverall(cardsQuery.data, result?.profileId ?? null),
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
    canPick,
    pickRows,
    pick,
    onPick: setPick,
    openPick: () => resetPick("pick"),
    backToDonor: () => resetPick("donor"),
    confirmPick: () => {
      const entering = donor?.outfield.find(
        (item) => item.person.personId === pick
      )?.person;
      if (entering) void draw(entering);
    },
    backToMatch: () => router.dismissTo(`/racha/${id}/event/${eventId}/match`),
    cancel: close,
  };
}
