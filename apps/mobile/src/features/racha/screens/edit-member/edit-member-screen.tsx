import { ActivityIndicator } from "react-native";
import { EmptyState, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";
import { EditMemberForm } from "./edit-member-form";
import { MemberCardView } from "./member-card-view";
import { useEditMemberScreen } from "./use-edit-member-screen";

export const EditMemberScreen = () => {
  const {
    racha,
    member,
    viewMember,
    viewCard,
    rachaName,
    adminCount,
    isLoading,
    isError,
    retry,
    isRetrying,
  } = useEditMemberScreen();

  return (
    <Screen title={viewMember ? "Membro" : "Editar membro"} canGoBack>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : viewMember ? (
        <MemberCardView
          member={viewMember}
          card={viewCard}
          rachaName={rachaName}
        />
      ) : isError || !racha || !member ? (
        <EmptyState
          title="Não deu pra abrir o membro"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <EditMemberForm
          rachaId={racha.id}
          viewerRole={racha.role}
          member={member}
          adminCount={adminCount}
          outfieldPerTeam={racha.rules.outfieldPerTeam}
        />
      )}
    </Screen>
  );
};
