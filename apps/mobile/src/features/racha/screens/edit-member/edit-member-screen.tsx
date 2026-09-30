import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  EmptyState,
  Screen,
  ChipGroup,
  ScreenFooter,
  Text,
} from "@/ui/components";

import { theme } from "@/ui/theme";
import { RoleChip } from "../../components/role-chip";
import { StarsAndSuperStarField } from "../../components/stars-and-super-star-field";
import { TMemberRole, TRachaMember } from "../../racha-types";
import { ADMIN_LIMIT_HINT } from "../../utils/racha-messages";
import {
  useEditMemberForm,
  useEditMemberScreen,
} from "./use-edit-member-screen";

export const EditMemberScreen = () => {
  const { racha, member, adminCount, isLoading, isError, retry, isRetrying } =
    useEditMemberScreen();

  return (
    <Screen title="Editar membro" canGoBack>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
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
        />
      )}
    </Screen>
  );
};

type TEditMemberFormProps = {
  rachaId: string;
  viewerRole: TMemberRole;
  member: TRachaMember;
  adminCount: number;
};

const EditMemberForm = (props: TEditMemberFormProps) => {
  const { member } = props;
  const {
    permissions,
    hasCard,
    isGoalkeeper,
    playsAsText,
    stars,
    onStarsChange,
    isSuperStar,
    onSuperStarChange,
    role,
    onRoleChange,
    isAdminCapped,
    isSaving,
    isDirty,
    failureMessage,
    save,
    openTransfer,
    openExpel,
  } = useEditMemberForm(props);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <Avatar
            name={member.displayName}
            photoUrl={member.photoUrl}
            size={48}
          />
          <View style={styles.identityTexts}>
            <Text style={styles.name}>{member.displayName}</Text>
            <View style={styles.metaRow}>
              {member.role !== "PLAYER" ? (
                <RoleChip role={member.role} />
              ) : null}
              <Text preset="small" color="muted" style={styles.position}>
                {playsAsText}
              </Text>
            </View>
          </View>
        </View>

        {hasCard ? (
          <View style={styles.card}>
            <StarsAndSuperStarField
              isGoalkeeper={isGoalkeeper}
              stars={stars}
              onStarsChange={onStarsChange}
              isSuperStar={isSuperStar}
              onSuperStarChange={onSuperStarChange}
              isDisabled={isSaving}
            />
          </View>
        ) : null}

        {permissions.canChangeRole ? (
          <ChipGroup
            label="Cargo"
            isFullWidth
            isDisabled={isSaving}
            value={role}
            onChange={onRoleChange}
            options={[
              { value: "PLAYER", label: "Jogador" },
              { value: "ADMIN", label: "Admin", isDisabled: isAdminCapped },
            ]}
            hint={isAdminCapped ? ADMIN_LIMIT_HINT : undefined}
          />
        ) : null}

        {permissions.canTransferOwnership || permissions.canExpel ? (
          <View style={styles.dangerZone}>
            {permissions.canTransferOwnership ? (
              <Button
                preset="outline"
                title="Passar o racha"
                accessibilityHint="Abre a confirmação"
                isDisabled={isSaving}
                onPress={openTransfer}
                style={styles.zoneButton}
              />
            ) : null}
            {permissions.canExpel ? (
              <Button
                preset="destructiveOutline"
                title="Expulsar do racha"
                accessibilityHint="Abre a confirmação"
                isDisabled={isSaving}
                onPress={openExpel}
                style={styles.zoneButton}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ScreenFooter>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Salvar"
          accessibilityLabel={isSaving ? "Salvando" : "Salvar"}
          accessibilityHint={
            isDirty ? undefined : "Altere algum campo para salvar"
          }
          isLoading={isSaving}
          isDisabled={!isDirty}
          onPress={save}
        />
      </ScreenFooter>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: 24, paddingBottom: theme.space[24] },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  identityTexts: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: "Manrope-Bold", fontSize: 18, lineHeight: 24 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  position: { fontFamily: "Manrope-Bold" },
  card: {
    gap: 16,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  dangerZone: {
    gap: theme.space[8],
    paddingTop: theme.space[32],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  zoneButton: { minHeight: 48 },
});
