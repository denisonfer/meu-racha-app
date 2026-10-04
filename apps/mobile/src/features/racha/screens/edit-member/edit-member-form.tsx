import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  ChipGroup,
  NoticeBanner,
  PlayerCard,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { PositionDetailSlots } from "../../components/position-detail-slots";
import { RoleChip } from "../../components/role-chip";
import { StarsAndSuperStarField } from "../../components/stars-and-super-star-field";
import { TMemberRole, TRachaMember } from "../../racha-types";
import {
  ADMIN_LIMIT_HINT,
  POSITION_DETAIL_MEMBER_HINT,
  POSITION_DETAIL_SECTION,
  positionDetailMemberPending,
} from "../../utils/racha-messages";
import { useEditMemberForm } from "./use-edit-member-screen";

const CARD_WIDTH = 240;

type TEditMemberFormProps = {
  rachaId: string;
  viewerRole: TMemberRole;
  member: TRachaMember;
  adminCount: number;
  outfieldPerTeam: number;
};

export const EditMemberForm = (props: TEditMemberFormProps) => {
  const { member } = props;
  const {
    permissions,
    hasCard,
    isGoalkeeper,
    card,
    stars,
    onStarsChange,
    isSuperStar,
    onSuperStarChange,
    role,
    onRoleChange,
    detailSection,
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
          <PlayerCard width={CARD_WIDTH} {...card} />
          {member.role !== "PLAYER" ? <RoleChip role={member.role} /> : null}
        </View>

        {detailSection ? (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text preset="h3">{POSITION_DETAIL_SECTION}</Text>
              <Text preset="small" color="muted">
                {POSITION_DETAIL_MEMBER_HINT}
              </Text>
            </View>
            {detailSection.isPending ? (
              <NoticeBanner
                tone="warning"
                text={positionDetailMemberPending(member.displayName)}
              />
            ) : null}
            <PositionDetailSlots
              slots={detailSection.slots}
              values={detailSection.values}
              errors={{}}
              onChange={detailSection.onChange}
              isDisabled={isSaving}
            />
          </View>
        ) : null}

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
  identity: { alignItems: "center", gap: 12 },
  card: {
    gap: 16,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  sectionHead: { gap: theme.space[4] },
  dangerZone: {
    gap: theme.space[8],
    paddingTop: theme.space[32],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  zoneButton: { minHeight: 48 },
});
