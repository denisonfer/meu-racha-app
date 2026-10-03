import { formatPlaysAs, OVERALL_MIN } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import type { TSortPersonListRow } from "../../components/sort-person-list";
import {
  useEventSort,
  useEventSortOperations,
} from "../../hooks/use-event-sort";
import { useRachaMembers } from "../../hooks/use-racha-members";
import {
  SORT_INCLUDE,
  sortFailureMessage,
  sortIncludeLabel,
} from "../../utils/racha-messages";
import {
  emptyGuestForm,
  guestFormSchema,
  type TGuestFormValues,
} from "../attendance/guest-schema";

export function useIncludeSortScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const sortQuery = useEventSort(id, eventId);
  const membersQuery = useRachaMembers(id);
  const { includeEventSortMember, includeEventSortGuest } =
    useEventSortOperations(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  const [mode, setMode] = useState<"list" | "guest">("list");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [values, setValues] = useState<TGuestFormValues>(emptyGuestForm);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [guestFailure, setGuestFailure] = useState<string | null>(null);

  const published =
    sortQuery.data?.state === "published" ? sortQuery.data : null;
  // o banco diz quem inclui; sem permissão (ou sem Sorteio) a folha não tem o que mostrar
  const isMissing = sortQuery.isSuccess && !published?.viewer.canInclude;
  useEffect(() => {
    if (isMissing && navigation.isFocused()) router.back();
  }, [isMissing, navigation]);

  // quem já está num Time ou saiu não entra por aqui: Saída tem a Volta
  const unavailable = new Set<string>();
  for (const team of published?.teams ?? []) {
    for (const player of team.players) {
      if (player.profileId) unavailable.add(player.profileId);
    }
    if (team.goalkeeper?.profileId) unavailable.add(team.goalkeeper.profileId);
  }
  for (const entry of published?.goalkeeperQueue ?? []) {
    if (entry.profileId) unavailable.add(entry.profileId);
  }
  for (const person of published?.left ?? []) {
    if (person.profileId) unavailable.add(person.profileId);
  }

  const include = async (profileId: string) => {
    if (busyId) return;
    setFailureMessage(null);
    setBusyId(profileId);
    try {
      await includeEventSortMember(profileId);
      close();
    } catch (error) {
      setFailureMessage(sortFailureMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const memberRows: TSortPersonListRow[] = (membersQuery.data ?? [])
    .filter((member) => !unavailable.has(member.profileId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((member) => ({
      key: member.profileId,
      name: member.displayName,
      photoUrl: member.photoUrl,
      overall: OVERALL_MIN,
      detail: formatPlaysAs(
        member.playsAs,
        member.primaryPosition,
        member.secondaryPosition
      ),
      accessibilityLabel: member.displayName,
      isSelected: false,
      onPress: null,
      action: {
        label: SORT_INCLUDE,
        accessibilityLabel: sortIncludeLabel(member.displayName),
        isDisabled: busyId !== null,
        onPress: () => void include(member.profileId),
      },
    }));

  const parsed = guestFormSchema.safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const errors = triedSubmit
    ? {
        displayName: issues.find((i) => i.path[0] === "displayName")?.message,
        primaryPosition: issues.find((i) => i.path[0] === "primaryPosition")
          ?.message,
        secondaryPosition: issues.find((i) => i.path[0] === "secondaryPosition")
          ?.message,
        stars: issues.find((i) => i.path[0] === "stars")?.message,
      }
    : {};

  const submitGuest = async () => {
    setTriedSubmit(true);
    const result = guestFormSchema.safeParse(values);
    if (!result.success) return;
    const data = result.data;
    const isGoalkeeper = data.playsAs === "GOALKEEPER";

    setGuestFailure(null);
    setIsSaving(true);
    try {
      await includeEventSortGuest({
        displayName: data.displayName,
        playsAs: data.playsAs,
        primaryPosition: isGoalkeeper ? null : data.primaryPosition,
        secondaryPosition: isGoalkeeper ? null : data.secondaryPosition,
        stars: isGoalkeeper ? null : data.stars,
        isSuperStar: isGoalkeeper ? false : data.isSuperStar,
      });
      close();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(sortFailureMessage(error), "danger");
        return;
      }
      setIsSaving(false);
      setGuestFailure(sortFailureMessage(error));
    }
  };

  return {
    isMissing,
    mode,
    isLoadingMembers: sortQuery.isPending || membersQuery.isPending,
    hasMembersError: membersQuery.isError,
    memberRows,
    failureMessage,
    guestForm: {
      values,
      errors,
      failureMessage: guestFailure,
      isSaving,
      canSubmit: !isSaving,
      onChange: (patch: Partial<TGuestFormValues>) => {
        setGuestFailure(null);
        setValues((current) => ({ ...current, ...patch }));
      },
      onSubmit: () => void submitGuest(),
    },
    openGuest: () => setMode("guest"),
    backToList: () => {
      setGuestFailure(null);
      setMode("list");
    },
  };
}
