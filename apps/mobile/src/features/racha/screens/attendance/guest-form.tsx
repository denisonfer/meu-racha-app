import { type TPosition } from "@meu-racha/domain";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, ChipGroup, Input, NoticeBanner, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { StarsAndSuperStarField } from "../../components/stars-and-super-star-field";
import { ATTENDANCE_GUEST_AGE_NOTICE } from "../../utils/racha-messages";
import { TGuestFormValues } from "./guest-schema";

const PLAYS_AS_OPTIONS = [
  { value: "OUTFIELD" as const, label: "Linha" },
  { value: "GOALKEEPER" as const, label: "Gol" },
];

const POSITION_OPTIONS: { value: TPosition; label: string }[] = [
  { value: "DEFENDER", label: "DEF" },
  { value: "MIDFIELDER", label: "MEI" },
  { value: "FORWARD", label: "ATA" },
  { value: "ANY", label: "TODAS" },
];

type TGuestFormProps = {
  values: TGuestFormValues;
  errors: Partial<Record<keyof TGuestFormValues, string>>;
  failureMessage: string | null;
  isSaving: boolean;
  canSubmit: boolean;
  onChange: (patch: Partial<TGuestFormValues>) => void;
  onSubmit: () => void;
};

export const GuestForm = ({
  values,
  errors,
  failureMessage,
  isSaving,
  canSubmit,
  onChange,
  onSubmit,
}: TGuestFormProps) => {
  const isOutfield = values.playsAs === "OUTFIELD";
  const needsSecondary =
    isOutfield &&
    values.primaryPosition != null &&
    values.primaryPosition !== "ANY";

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Input
        label="Nome"
        value={values.displayName}
        onChangeText={(displayName) => onChange({ displayName })}
        error={errors.displayName}
        isDisabled={isSaving}
        autoCapitalize="words"
      />

      <ChipGroup
        label="Onde joga"
        isFullWidth
        isDisabled={isSaving}
        value={values.playsAs}
        onChange={(playsAs) =>
          onChange({
            playsAs,
            primaryPosition: null,
            secondaryPosition: null,
            stars: playsAs === "GOALKEEPER" ? null : values.stars,
            isSuperStar: playsAs === "GOALKEEPER" ? false : values.isSuperStar,
          })
        }
        options={PLAYS_AS_OPTIONS}
      />

      {isOutfield ? (
        <>
          <ChipGroup
            label="Posição principal"
            isDisabled={isSaving}
            value={values.primaryPosition}
            onChange={(primaryPosition) =>
              onChange({
                primaryPosition,
                secondaryPosition:
                  primaryPosition === "ANY" ||
                  primaryPosition === values.secondaryPosition
                    ? null
                    : values.secondaryPosition,
              })
            }
            options={POSITION_OPTIONS}
            error={errors.primaryPosition}
          />

          {needsSecondary ? (
            <ChipGroup
              label="Posição secundária"
              isDisabled={isSaving}
              value={values.secondaryPosition}
              onChange={(secondaryPosition) => onChange({ secondaryPosition })}
              options={POSITION_OPTIONS.filter(
                (option) =>
                  option.value !== "ANY" &&
                  option.value !== values.primaryPosition
              )}
              error={errors.secondaryPosition}
            />
          ) : null}

          <StarsAndSuperStarField
            isGoalkeeper={false}
            stars={values.stars}
            onStarsChange={(stars) => onChange({ stars })}
            isSuperStar={values.isSuperStar}
            onSuperStarChange={(isSuperStar) => onChange({ isSuperStar })}
            isDisabled={isSaving}
          />
          {errors.stars ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {errors.stars}
            </Text>
          ) : null}
        </>
      ) : (
        <StarsAndSuperStarField
          isGoalkeeper
          stars={null}
          onStarsChange={() => undefined}
          isSuperStar={false}
          onSuperStarChange={() => undefined}
          isDisabled={isSaving}
        />
      )}

      <NoticeBanner tone="warning" text={ATTENDANCE_GUEST_AGE_NOTICE} />

      <View style={styles.footer}>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Adicionar avulso"
          onPress={onSubmit}
          isDisabled={!canSubmit}
          isLoading={isSaving}
          accessibilityLabel={isSaving ? "Adicionando" : "Adicionar avulso"}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { gap: theme.space[16], paddingBottom: theme.space[8] },
  footer: { gap: 10, paddingTop: theme.space[8] },
});
