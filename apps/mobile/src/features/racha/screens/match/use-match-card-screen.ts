import {
  cardOutcome,
  matchElapsedSeconds,
  serverOffsetMs,
  yellowOutSeconds,
  type TMatchCardColor,
  type TMatchPerson,
} from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import {
  MATCH_CARD_KEEPER_NOTE,
  MATCH_CARD_MARK_KEEPER_NOTE,
  MATCH_CARD_MARK_KEEPER_TEXT,
  MATCH_CARD_MARK_NO_REINFORCE,
  MATCH_CARD_MARK_TEXT,
  MATCH_CARD_NO_REINFORCE,
  MATCH_CARD_RED,
  MATCH_CARD_RED_TEXT,
  MATCH_CARD_REGISTER_RED,
  MATCH_CARD_REGISTER_SECOND,
  MATCH_CARD_REGISTER_YELLOW,
  MATCH_CARD_SECOND_TITLE,
  MATCH_CARD_YELLOW,
  SORT_LEAVE_BUSY,
  matchCardHasYellow,
  matchCardKeeperRedText,
  matchCardKeeperYellowText,
  matchCardRedOutfieldText,
  matchCardSecondText,
  matchCardTarget,
  matchCardTitle,
  matchCardYellowText,
  matchFailureMessage,
} from "../../utils/racha-messages";
import { formatClock } from "./match-format";

function samePerson(
  person: TMatchPerson,
  profileId: string | undefined,
  guestId: string | undefined
) {
  if (profileId) return person.profileId === profileId;
  if (guestId) return person.guestId === guestId;
  return false;
}

export function useMatchCardScreen() {
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
  const actions = useEventMatchActions(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [choice, setChoice] = useState<TMatchCardColor>("yellow");
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
  const keeper = side?.goalkeeper ?? null;
  const isKeeper = keeper != null && samePerson(keeper, profileId, guestId);
  const person = isKeeper
    ? keeper
    : (side?.lineup.find((entry) =>
        samePerson(entry.person, profileId, guestId)
      )?.person ?? null);

  const offset = portrait
    ? serverOffsetMs(portrait.serverNow, matchQuery.dataUpdatedAt)
    : 0;
  const elapsed = portrait
    ? matchElapsedSeconds(
        {
          startedAt: portrait.startedAt,
          pausedAt: portrait.pausedAt,
          pausedSeconds: portrait.pausedSeconds,
        },
        nowMs + offset
      )
    : 0;

  const cards = match?.cards ?? [];
  const personId = person?.personId ?? "";
  const isSecond =
    person != null &&
    cardOutcome(cards, personId, "yellow").reason === "secondYellow";
  const priorYellow = cards
    .filter(
      (card) => card.person.personId === personId && card.color === "yellow"
    )
    .sort(
      (a, b) =>
        a.matchSecond - b.matchSecond || a.createdAt.localeCompare(b.createdAt)
    )[0];
  const displayName = person?.displayName ?? name ?? "";
  const teamNumber = side?.teamNumber ?? 0;
  const staying = Math.max(0, (side?.capacity ?? 0) - 1);
  const isMark = portrait?.yellowCardMode === "mark";
  const outMin = portrait?.yellowOutMin ?? 2;
  const until = formatClock(elapsed + yellowOutSeconds("timed", outMin));

  const confirm = async () => {
    if (!match || !person || isSaving) return;
    setFailureMessage(null);
    setIsSaving(true);
    try {
      await actions.addEventMatchCard({
        matchId: match.id,
        profileId: person.profileId,
        guestId: person.guestId,
        color: choice,
      });
      router.back();
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
    isMissing: !match || !teamId || side == null || person == null,
    title: matchCardTitle(displayName),
    supporting: matchCardTarget(teamNumber, isKeeper),
    notice:
      isSecond && priorYellow
        ? matchCardHasYellow(displayName, formatClock(priorYellow.matchSecond))
        : null,
    yellowTitle: isSecond ? MATCH_CARD_SECOND_TITLE : MATCH_CARD_YELLOW,
    yellowText: isSecond
      ? matchCardSecondText(displayName, teamNumber, staying)
      : isMark
        ? isKeeper
          ? MATCH_CARD_MARK_KEEPER_TEXT
          : MATCH_CARD_MARK_TEXT
        : isKeeper
          ? matchCardKeeperYellowText(outMin, teamNumber, staying, until)
          : matchCardYellowText(outMin, teamNumber, staying, until),
    redTitle: MATCH_CARD_RED,
    redText: isSecond
      ? MATCH_CARD_RED_TEXT
      : isKeeper
        ? matchCardKeeperRedText(teamNumber, staying)
        : matchCardRedOutfieldText(teamNumber, staying),
    note: isMark
      ? isKeeper
        ? MATCH_CARD_MARK_KEEPER_NOTE
        : MATCH_CARD_MARK_NO_REINFORCE
      : isKeeper
        ? MATCH_CARD_KEEPER_NOTE
        : MATCH_CARD_NO_REINFORCE,
    choice,
    onChoice: setChoice,
    primaryLabel:
      choice === "red"
        ? MATCH_CARD_REGISTER_RED
        : isSecond
          ? MATCH_CARD_REGISTER_SECOND
          : MATCH_CARD_REGISTER_YELLOW,
    busyLabel: SORT_LEAVE_BUSY,
    isBusy: isSaving,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
