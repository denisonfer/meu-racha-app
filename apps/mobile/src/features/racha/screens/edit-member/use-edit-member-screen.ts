import {
  ADMIN_LIMIT_FREE,
  formatPlaysAs,
  memberPermissions,
} from "@meu-racha/domain";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
  type Href,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { useRacha } from "../../hooks/use-racha";
import { useRachaMembers } from "../../hooks/use-racha-members";
import { useUpdateMember } from "../../hooks/use-update-member";
import { TMemberRole, TRachaMember } from "../../racha-types";
import { isNoAccessError } from "../../utils/no-access";
import {
  ADMIN_LIMIT_REACHED,
  DISCARD_CHANGES_TITLE,
  MEMBER_GONE,
  MEMBER_NOT_ALLOWED,
  MEMBER_SAVED,
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
  const rachaQuery = useRacha(id);

  const racha = rachaQuery.data;
  const found = membersQuery.data?.find((m) => m.profileId === profileId);
  // depois de aberta, a tela não trata o Membro sumir da lista como "saiu": quem
  // tira o Membro (salvar com not_member, expulsar) já cuida da própria saída
  const [opened, setOpened] = useState<TRachaMember | null>(null);
  const member = found ?? opened ?? undefined;

  const isNoAccess =
    isNoAccessError(membersQuery.error) || isNoAccessError(rachaQuery.error);
  const isLoading = membersQuery.isPending || rachaQuery.isPending;
  const isError = membersQuery.isError || rachaQuery.isError;

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
  const isBlocked = isReady && Boolean(member) && !canOpen && !opened;
  const isOpen = isReady && Boolean(member) && canOpen && !isNoAccess;

  useEffect(() => {
    if (isNoAccess) router.dismissTo("/rachas");
  }, [isNoAccess]);

  useEffect(() => {
    if (isGone) {
      router.back();
      showToast(MEMBER_GONE);
    } else if (isBlocked) {
      router.back();
    }
  }, [isGone, isBlocked, showToast]);

  if (isOpen && found && found !== opened) setOpened(found);

  return {
    racha: isOpen ? racha : undefined,
    member: isOpen ? member : undefined,
    members: membersQuery.data ?? [],
    isLoading: isLoading || isNoAccess || isGone || isBlocked,
    isError: isError && !isNoAccess,
    retry: () => {
      void membersQuery.refetch();
      void rachaQuery.refetch();
    },
    isRetrying: membersQuery.isRefetching || rachaQuery.isRefetching,
  };
}

type TEditMemberFormArgs = {
  rachaId: string;
  viewerRole: TMemberRole;
  member: TRachaMember;
  adminCount: number;
};

export function useEditMemberForm({
  rachaId,
  viewerRole,
  member,
  adminCount,
}: TEditMemberFormArgs) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const showToast = useToast();
  const { session } = useSession();
  const { updateMember } = useUpdateMember(rachaId);

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
  }));
  const [stars, setStars] = useState(initial.stars);
  const [isSuperStar, setIsSuperStar] = useState(initial.isSuperStar);
  const [role, setRole] = useState(initial.role);
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isDirty =
    stars !== initial.stars ||
    isSuperStar !== initial.isSuperStar ||
    role !== initial.role;

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
    setFailure(null);
    setIsSaving(true);
    try {
      await updateMember(member.profileId, {
        stars: isGoalkeeper ? null : stars,
        isSuperStar: isGoalkeeper ? false : isSuperStar,
        role,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "admin_limit") {
        setRole(initial.role);
        setFailure(ADMIN_LIMIT_REACHED);
      } else if (code === "not_member") {
        showToast(MEMBER_GONE);
        setIsLeaving(true);
      } else if (code === "not_allowed") {
        router.dismissTo(`/racha/${rachaId}`);
        showToast(MEMBER_NOT_ALLOWED);
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
    isGoalkeeper,
    playsAsText: formatPlaysAs(
      member.playsAs,
      member.primaryPosition,
      member.secondaryPosition
    ).replace(/^Linha · /, ""),
    stars,
    onStarsChange: change(setStars),
    isSuperStar,
    onSuperStarChange: change(setIsSuperStar),
    role,
    onRoleChange: change(setRole),
    isAdminCapped,
    isSaving,
    isDirty,
    failureMessage: failure,
    save: () => void save(),
    openExpel: () =>
      // a rota da folha de expulsar vem na tarefa seguinte; a Tarefa 7 remove o cast
      router.push(`/racha/${rachaId}/member/${member.profileId}/expel` as Href),
  };
}
