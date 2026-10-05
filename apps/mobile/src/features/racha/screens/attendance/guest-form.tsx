import {
  positionDetailFits,
  positionDetailOptions,
  type TPosition,
  type TPositionDetail,
} from "@meu-racha/domain";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Button, ChipGroup, Input, NoticeBanner, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { PositionDetailField } from "../../components/position-detail-field";
import { StarsAndSuperStarField } from "../../components/stars-and-super-star-field";
import {
  positionDetailFieldA11yLabel,
  positionDetailZoneLabel,
  type TPositionSlot,
} from "../../utils/racha-labels";
import {
  ATTENDANCE_GUEST_AGE_NOTICE,
  POSITION_DETAIL_GUEST_HINT,
} from "../../utils/racha-messages";
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

// a subdivisão escolhida só sobrevive se ainda couber na zona nova
const keepDetail = (zone: TPosition | null, detail: TPositionDetail | null) =>
  zone !== null && positionDetailFits(zone, detail) ? detail : null;

type TGuestFormProps = {
  values: TGuestFormValues;
  errors: Partial<Record<keyof TGuestFormValues, string>>;
  // Evento 8+: DEF e MEI pedem a subdivisão logo abaixo da zona
  asksPositionDetail: boolean;
  failureMessage: string | null;
  isSaving: boolean;
  canSubmit: boolean;
  hint?: string;
  onChange: (patch: Partial<TGuestFormValues>) => void;
  onSubmit: () => void;
};

export const GuestForm = ({
  values,
  errors,
  asksPositionDetail,
  failureMessage,
  isSaving,
  canSubmit,
  hint,
  onChange,
  onSubmit,
}: TGuestFormProps) => {
  const { height } = useWindowDimensions();
  const isOutfield = values.playsAs === "OUTFIELD";
  const needsSecondary =
    isOutfield &&
    values.primaryPosition != null &&
    values.primaryPosition !== "ANY";

  const detailField = (
    slot: TPositionSlot,
    zone: TPosition | null,
    value: TPositionDetail | null,
    error: string | undefined
  ) => {
    const options = positionDetailOptions(zone);
    if (!asksPositionDetail || zone === null || options.length === 0) {
      return null;
    }
    const key =
      slot === "primary" ? "primaryPositionDetail" : "secondaryPositionDetail";
    return (
      <PositionDetailField
        label={positionDetailZoneLabel(zone)}
        accessibilityLabel={positionDetailFieldA11yLabel(zone, slot)}
        options={options}
        value={value}
        onChange={(detail) => onChange({ [key]: detail })}
        error={error}
        isDisabled={isSaving}
      />
    );
  };

  return (
    // a folha mede o conteúdo (fitToContents): sem teto, o ScrollView cresce com
    // ele, nunca rola, e com as subdivisões o fim do formulário fica cortado
    <ScrollView
      style={{ maxHeight: height * 0.6 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
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
            primaryPositionDetail: null,
            secondaryPositionDetail: null,
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
            onChange={(primaryPosition) => {
              const secondaryPosition =
                primaryPosition === "ANY" ||
                primaryPosition === values.secondaryPosition
                  ? null
                  : values.secondaryPosition;
              onChange({
                primaryPosition,
                secondaryPosition,
                primaryPositionDetail: keepDetail(
                  primaryPosition,
                  values.primaryPositionDetail
                ),
                secondaryPositionDetail: keepDetail(
                  secondaryPosition,
                  values.secondaryPositionDetail
                ),
              });
            }}
            options={POSITION_OPTIONS}
            error={errors.primaryPosition}
          />
          {detailField(
            "primary",
            values.primaryPosition,
            values.primaryPositionDetail,
            errors.primaryPositionDetail
          )}

          {needsSecondary ? (
            <>
              <ChipGroup
                label="Posição secundária"
                isDisabled={isSaving}
                value={values.secondaryPosition}
                onChange={(secondaryPosition) =>
                  onChange({
                    secondaryPosition,
                    secondaryPositionDetail: keepDetail(
                      secondaryPosition,
                      values.secondaryPositionDetail
                    ),
                  })
                }
                options={POSITION_OPTIONS.filter(
                  (option) =>
                    option.value !== "ANY" &&
                    option.value !== values.primaryPosition
                )}
                error={errors.secondaryPosition}
              />
              {detailField(
                "secondary",
                values.secondaryPosition,
                values.secondaryPositionDetail,
                errors.secondaryPositionDetail
              )}
            </>
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
          {asksPositionDetail ? (
            <Text preset="small" color="muted">
              {POSITION_DETAIL_GUEST_HINT}
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
        {hint ? (
          <Text preset="small" color="muted">
            {hint}
          </Text>
        ) : null}
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
