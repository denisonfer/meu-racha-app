import {
  ADMIN_LIMIT_FREE,
  asksPositionDetail,
  memberPermissions,
  type TPositionDetail,
} from "@meu-racha/domain";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { useRacha } from "../../hooks/use-racha";
import { useRachaCards } from "../../hooks/use-racha-cards";
import { useRachaMembers } from "../../hooks/use-racha-members";
import { useSetMemberPositionDetails } from "../../hooks/use-set-member-position-details";
import { useUpdateMember } from "../../hooks/use-update-member";
import { TMemberRole, TRachaMember } from "../../racha-types";
import { memberCardProps } from "../../utils/member-card";
import { isNoAccessError } from "../../utils/no-access";
import {
  hasDetailChoice,
  positionDetailSlots,
} from "../../utils/position-detail-view";
import type { TPositionSlot } from "../../utils/racha-labels";
import {
  ADMIN_LIMIT_REACHED,
  DISCARD_CHANGES_TITLE,
  MEMBER_GONE,
  MEMBER_NOT_ALLOWED,
  MEMBER_SAVED,
  POSITION_DETAIL_MISMATCH,
  SAVE_MEMBER_FAILED,
} from "../../utils/racha-messages";

export function useEditMemberScreen() {
  const { id, profileId } = useLocalSearchParams<{
    id: string;
    profileId: string;
  }>();
  const { session } = useSession();
  const showToast = useToast();
  const membersQuery = useRachaMembers(id);
  const cardsQuery = useRachaCards(id);
  const rachaQuery = useRacha(id);

  const racha = rachaQuery.data;
  const found = membersQuery.data?.find((m) => m.profileId === profileId);
  // depois de aberta, a tela não trata o Membro sumir da lista como "saiu": quem
  // tira o Membro (salvar com not_member, expulsar) já cuida da própria saída
  const [opened, setOpened] = useState<TRachaMember | null>(null);
  const member = found ?? opened ?? undefined;

  const noAccessQuery = isNoAccessError(membersQuery.error)
    ? membersQuery
    : rachaQuery;
  const isNoAccess = useLeaveOnNoAccess(
    noAccessQuery.error,
    noAccessQuery.fetchStatus,
    id
  );
  const isLoading =
    membersQuery.isPending || rachaQuery.isPending || cardsQuery.isLoading;
  // Sem a carta, o piso 40 parece Overall de verdade.
  const isError =
    membersQuery.isLoadingError ||
    rachaQuery.isLoadingError ||
    cardsQuery.isError;

  const canOpen =
    racha && member
      ? memberPermissions(
          racha.role,
          member.role,
          member.profileId === session?.userId,
          member.playsAs === "GOALKEEPER"
        ).canOpen
      : false;

  const isReady = !isLoading && !isError && Boolean(racha);
  const isGone = isReady && !member;
  // quem não edita vê a carta do Membro, só leitura (Estrelas são públicas, 8.1);
  // perder a permissão com a tela aberta apenas troca para essa visão
  const isOpen = isReady && Boolean(member) && canOpen && !isNoAccess;
  const isViewOnly = isReady && Boolean(member) && !canOpen && !isNoAccess;

  useEffect(() => {
    if (isGone) {
      router.back();
      showToast(MEMBER_GONE);
    }
  }, [isGone, showToast]);

  if (isOpen && found && found !== opened) setOpened(found);

  return {
    racha: isOpen ? racha : undefined,
    member: isOpen ? member : undefined,
    viewMember: isViewOnly ? member : undefined,
    viewCard:
      isViewOnly && member
        ? (cardsQuery.data?.get(member.profileId) ?? null)
        : null,
    rachaName: rachaQuery.data?.name ?? "",
    adminCount: (membersQuery.data ?? []).filter((m) => m.role === "ADMIN")
      .length,
    isLoading: isLoading || isNoAccess || isGone,
    isError: isError && !isNoAccess,
    retry: () => {
      void membersQuery.refetch();
      void cardsQuery.refetch();
      void rachaQuery.refetch();
    },
    isRetrying:
      membersQuery.isRefetching ||
      cardsQuery.isRefetching ||
      rachaQuery.isRefetching,
  };
}

type TEditMemberFormArgs = {
  rachaId: string;
  viewerRole: TMemberRole;
  member: TRachaMember;
  adminCount: number;
  outfieldPerTeam: number;
};

export function useEditMemberForm({
  rachaId,
  viewerRole,
  member,
  adminCount,
  outfieldPerTeam,
}: TEditMemberFormArgs) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const showToast = useToast();
  const { session } = useSession();
  const { updateMember } = useUpdateMember(rachaId);
  const { setMemberPositionDetails } = useSetMemberPositionDetails(rachaId);
  const hasRachaAccess = useHasRachaAccess(rachaId);
  const cardsQuery = useRachaCards(rachaId);
  const rachaQuery = useRacha(rachaId);

  const isGoalkeeper = member.playsAs === "GOALKEEPER";
  const permissions = memberPermissions(
    viewerRole,
    member.role,
    member.profileId === session?.userId,
    isGoalkeeper
  );

  // uma recarga da lista no meio da edição não pode reescrever o que foi mexido
  const [initial] = useState(() => ({
    stars: member.stars,
    isSuperStar: member.isSuperStar,
    role: member.role,
    details: {
      primary: member.primaryPositionDetail,
      secondary: member.secondaryPositionDetail,
    } as Record<TPositionSlot, TPositionDetail | null>,
  }));
  const [stars, setStars] = useState(initial.stars);
  const [isSuperStar, setIsSuperStar] = useState(initial.isSuperStar);
  const [role, setRole] = useState(initial.role);
  const [details, setDetails] = useState(initial.details);
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Racha 8+ divide defesa e meio-campo; Goleiro e ATA/TODAS não têm o que escolher
  const detailSlots = asksPositionDetail(outfieldPerTeam)
    ? positionDetailSlots(member)
    : [];
  const hasDetailSection = hasDetailChoice(detailSlots);
  const isDetailPending = detailSlots.some(
    (slot) => slot.options.length > 0 && initial.details[slot.slot] === null
  );

  const isStarsOrRoleDirty =
    stars !== initial.stars ||
    isSuperStar !== initial.isSuperStar ||
    role !== initial.role;
  const isDetailDirty =
    details.primary !== initial.details.primary ||
    details.secondary !== initial.details.secondary;
  const isDirty = isStarsOrRoleDirty || isDetailDirty;

  const hasCard =
    permissions.canEditStars ||
    (isGoalkeeper && (permissions.canChangeRole || permissions.canExpel));

  const isAdminCapped =
    initial.role === "PLAYER" && adminCount >= ADMIN_LIMIT_FREE;

  // só com a tela em foco: com a folha de expulsar por cima, a expulsão precisa
  // conseguir remover esta tela mesmo com mudança pendente
  usePreventRemove(
    isFocused && !isLeaving && (isDirty || isSaving),
    ({ data }) => {
      // dismissTo (ex.: depois de expulsar) não é um voltar da pessoa: sem alerta
      if (data.action.type === "POP_TO") {
        navigation.dispatch(data.action);
        return;
      }
      if (isSaving) return;
      Alert.alert(DISCARD_CHANGES_TITLE, undefined, [
        { text: "Continuar editando", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
    }
  );

  // sair depois de salvar: o bloqueio só cai no render seguinte
  useEffect(() => {
    if (isLeaving) router.back();
  }, [isLeaving]);

  const change = <T>(setter: (value: T) => void) => {
    return (value: T) => {
      setFailure(null);
      setter(value);
    };
  };

  const save = async () => {
    if (isSaving) return;
    setFailure(null);
    setIsSaving(true);
    try {
      // dois RPCs, cada um só quando o seu campo mudou: a subdivisão não passa
      // pela permissão de Estrelas/Cargo e vice-versa
      if (isStarsOrRoleDirty) {
        await updateMember(member.profileId, {
          stars: isGoalkeeper ? null : stars,
          isSuperStar: isGoalkeeper ? false : isSuperStar,
          role: role !== initial.role ? role : null,
        });
      }
      if (isDetailDirty) {
        await setMemberPositionDetails(member.profileId, details);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "position_detail_mismatch") {
        setFailure(POSITION_DETAIL_MISMATCH);
      } else if (code === "admin_limit") {
        setRole(initial.role);
        setFailure(ADMIN_LIMIT_REACHED);
      } else if (code === "not_member") {
        showToast(MEMBER_GONE);
        setIsLeaving(true);
      } else if (code === "not_allowed") {
        router.dismissTo(`/racha/${rachaId}`);
        if (await hasRachaAccess()) showToast(MEMBER_NOT_ALLOWED);
      } else {
        setFailure(SAVE_MEMBER_FAILED);
      }
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    showToast(MEMBER_SAVED, "success");
    setIsLeaving(true);
  };

  return {
    permissions,
    hasCard,
    isGoalkeeper,
    // a Super Estrela da carta acompanha o toggle, antes mesmo de salvar
    card: memberCardProps(
      member,
      isSuperStar,
      cardsQuery.data?.get(member.profileId) ?? null,
      rachaQuery.data?.name
    ),
    stars,
    onStarsChange: change(setStars),
    isSuperStar,
    onSuperStarChange: change(setIsSuperStar),
    role,
    onRoleChange: change(setRole),
    detailSection: hasDetailSection
      ? {
          slots: detailSlots,
          values: details,
          isPending: isDetailPending,
          onChange: (slot: TPositionSlot, value: TPositionDetail) => {
            setFailure(null);
            setDetails((current) => ({ ...current, [slot]: value }));
          },
        }
      : null,
    isAdminCapped,
    isSaving,
    isDirty,
    failureMessage: failure,
    save: () => void save(),
    openTransfer: () =>
      router.push(`/racha/${rachaId}/member/${member.profileId}/transfer`),
    openExpel: () =>
      router.push(`/racha/${rachaId}/member/${member.profileId}/expel`),
  };
}
