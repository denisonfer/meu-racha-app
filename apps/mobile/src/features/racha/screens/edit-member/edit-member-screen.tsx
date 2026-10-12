import { ActivityIndicator, StyleSheet, View } from "react-native";
import { EmptyState, IconButton, Screen } from "@/ui/components";
import { theme } from "@/ui/theme";
import { REPORT_OR_BLOCK } from "../../utils/racha-messages";
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
    canReport,
    openReportOrBlock,
    adminCount,
    isLoading,
    isError,
    retry,
    isRetrying,
  } = useEditMemberScreen();

  return (
    <Screen
      title={viewMember ? "Membro" : "Editar membro"}
      canGoBack
      headerRight={
        canReport ? (
          <View style={styles.headerRight}>
            <IconButton
              icon="flag"
              accessibilityLabel={REPORT_OR_BLOCK}
              onPress={openReportOrBlock}
            />
          </View>
        ) : undefined
      }
    >
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

const styles = StyleSheet.create({
  // o alvo de 44 sobra para fora: o título fica no centro, como no Perfil
  headerRight: { marginVertical: -10, marginRight: -10 },
});
