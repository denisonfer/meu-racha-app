import { TPosition } from "@meu-racha/domain";
import { Control, useWatch } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { FormChipGroup, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TSignUpFormInput } from "../sign-up-schema";

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

export const StepProfile = ({
  control,
}: {
  control: Control<TSignUpFormInput>;
}) => {
  const playsAs = useWatch({ control, name: "playsAs" });
  const primaryPosition = useWatch({ control, name: "primaryPosition" });

  const isOutfield = playsAs === "OUTFIELD";
  // COR (ANY) joga em qualquer camada, então não tem secundária (regra do domínio)
  const needsSecondary =
    isOutfield && primaryPosition && primaryPosition !== "ANY";

  return (
    <View style={styles.step}>
      <Text preset="h2" style={styles.title}>
        Sobre você
      </Text>

      {/* TODO: prévia do Card (PlayerCard) entra aqui */}
      <View style={styles.cardPlaceholder}>
        <Text preset="small" color="muted">
          prévia do Card
        </Text>
      </View>

      <FormChipGroup
        control={control}
        name="playsAs"
        label="Onde joga"
        options={PLAYS_AS_OPTIONS}
        isFullWidth
      />

      {isOutfield ? (
        <FormChipGroup
          control={control}
          name="primaryPosition"
          label="Posição principal"
          options={POSITION_OPTIONS}
        />
      ) : null}

      {needsSecondary ? (
        <FormChipGroup
          control={control}
          name="secondaryPosition"
          label="Posição secundária"
          options={POSITION_OPTIONS.filter(
            (o) => o.value !== "ANY" && o.value !== primaryPosition
          )}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  step: { gap: theme.space[16] },
  title: { textAlign: "center" },
  cardPlaceholder: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    aspectRatio: 0.72,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.divider,
  },
});
