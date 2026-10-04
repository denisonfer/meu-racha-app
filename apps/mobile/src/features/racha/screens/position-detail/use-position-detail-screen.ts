import type { TPositionDetail } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useSession } from "@/features/auth";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useRacha } from "../../hooks/use-racha";
import { useRachaMembers } from "../../hooks/use-racha-members";
import { useSetMemberPositionDetails } from "../../hooks/use-set-member-position-details";
import {
  hasDetailChoice,
  positionDetailSlots,
} from "../../utils/position-detail-view";
import type { TPositionSlot } from "../../utils/racha-labels";
import {
  ACTION_FAILED,
  POSITION_DETAIL_MISMATCH,
  POSITION_DETAIL_SAVE_FAILED,
  POSITION_DETAIL_SAVED,
} from "../../utils/racha-messages";

type TDetailValues = Record<TPositionSlot, TPositionDetail | null>;

/**
 * Folha de completar a subdivisão. Sem `profileId` é a do próprio Membro (U3);
 * com ele, o Dono/Admin completa a de quem está pendente no Sorteio (U6).
 */
export function usePositionDetailScreen() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId?: string;
  }>();
  const { session, isLoading: isSessionLoading } = useSession();
  const { data: racha } = useRacha(id);
  const membersQuery = useRachaMembers(id);
  const { setMemberPositionDetails } = useSetMemberPositionDetails(id);
  const navigation = useNavigation();
  const close = useBottomSheetClose();
  const showToast = useToast();

  const targetId = profileId ?? session?.userId;
  const isSelf = targetId === session?.userId;
  const target = membersQuery.data?.find(
    (member) => member.profileId === targetId
  );
  const slots = target ? positionDetailSlots(target) : [];

  // uma recarga da lista no meio da escolha não pode reescrever o que foi tocado
  const [values, setValues] = useState<TDetailValues | null>(null);
  if (target && values === null) {
    setValues({
      primary: target.primaryPositionDetail,
      secondary: target.secondaryPositionDetail,
    });
  }
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  // Jogador só completa a própria; sem o que escolher (Goleiro, ATA/TODAS, saiu
  // do Racha) a folha não tem conteúdo. A sessão chega depois do 1º render e a
  // lista já vem do cache: sem esperar por ela, a própria folha some ao abrir.
  const isMissing =
    !isSessionLoading &&
    ((racha != null && racha.role === "PLAYER" && !isSelf) ||
      (membersQuery.isSuccess && (!target || !hasDetailChoice(slots))));
  useEffect(() => {
    if (isMissing && navigation.isFocused()) router.back();
  }, [isMissing, navigation]);

  const current: TDetailValues = values ?? { primary: null, secondary: null };
  const missingErrors = Object.fromEntries(
    slots
      .filter((slot) => slot.options.length > 0 && current[slot.slot] === null)
      .map((slot) => [slot.slot, slot.requiredError])
  ) as Partial<Record<TPositionSlot, string>>;

  const submit = async () => {
    if (!target || isSaving) return;
    setTriedSubmit(true);
    if (Object.keys(missingErrors).length > 0) return;

    const choice = (slot: TPositionSlot) =>
      slots.some((item) => item.slot === slot && item.options.length > 0)
        ? current[slot]
        : null;

    setFailureMessage(null);
    setIsSaving(true);
    try {
      await setMemberPositionDetails(target.profileId, {
        primary: choice("primary"),
        secondary: choice("secondary"),
      });
      showToast(POSITION_DETAIL_SAVED, "success");
      close();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "not_member" || code === "not_allowed") {
        close();
        showToast(ACTION_FAILED);
        return;
      }
      setIsSaving(false);
      setFailureMessage(
        code === "position_detail_mismatch"
          ? POSITION_DETAIL_MISMATCH
          : POSITION_DETAIL_SAVE_FAILED
      );
    }
  };

  return {
    isMissing,
    isSelf,
    isLoading: isSessionLoading || membersQuery.isPending,
    isError: membersQuery.isError && !membersQuery.data,
    rachaName: racha?.name ?? null,
    memberName: target?.displayName ?? null,
    slots,
    values: current,
    errors: triedSubmit ? missingErrors : {},
    onChange: (slot: TPositionSlot, value: TPositionDetail) => {
      setFailureMessage(null);
      setValues({ ...current, [slot]: value });
    },
    failureMessage,
    isSaving,
    onSubmit: () => void submit(),
    retry: () => void membersQuery.refetch(),
  };
}
