import { TPosition } from "@meu-racha/domain";
import { Control, useWatch } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { Button, FormChipGroup, PlayerCard, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TSignUpFormInput } from "../sign-up-schema";
import { useCardPreview } from "./use-card-preview";
import { usePhotoPicker } from "./use-photo-picker";

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
  const cardPreview = useCardPreview(control);
  const photo = usePhotoPicker(control);

  const isOutfield = playsAs === "OUTFIELD";

  const needsSecondary =
    isOutfield && primaryPosition && primaryPosition !== "ANY";

  return (
    <View style={styles.step}>
      <Text preset="h2" style={styles.title}>
        Sobre você
      </Text>

      <View style={styles.preview}>
        <PlayerCard width={196} {...cardPreview} />
        <Button
          title={photo.hasPhoto ? "Trocar foto" : "Adicionar foto (opcional)"}
          preset="text"
          isLoading={photo.isPicking}
          onPress={photo.pick}
        />
        {photo.error ? (
          <Text preset="small" color="danger" style={styles.previewNote}>
            {photo.error}
          </Text>
        ) : null}
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
  preview: { alignItems: "center", gap: theme.space[8] },
  previewNote: { textAlign: "center" },
});
