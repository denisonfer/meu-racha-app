import { Control } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import type { TPickedImage } from "@/lib/image-picker";
import { Button, PlayerCard, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TSignUpFormInput } from "./sign-up-schema";
import { useCardPreview } from "./steps/use-card-preview";
import { usePhotoPicker } from "./steps/use-photo-picker";

export const PhotoFailed = ({
  control,
  onRetry,
  isRetrying,
}: {
  control: Control<TSignUpFormInput>;
  onRetry: (photo?: TPickedImage) => void;
  isRetrying: boolean;
}) => {
  const cardPreview = useCardPreview(control);
  const photo = usePhotoPicker(control, onRetry);

  return (
    <>
      <View style={styles.content}>
        <Text preset="h2" style={styles.centered}>
          Não deu pra salvar sua foto
        </Text>
        <Text color="muted" style={styles.centered}>
          Sua conta foi criada. Falta só a foto para você entrar.
        </Text>
        <PlayerCard width={196} {...cardPreview} />
        {photo.error ? (
          <Text preset="small" color="danger" style={styles.centered}>
            {photo.error}
          </Text>
        ) : null}
      </View>

      <ScreenFooter>
        <Button
          title="Tentar de novo"
          isLoading={isRetrying}
          isDisabled={photo.isPicking}
          onPress={() => onRetry()}
        />
        <Button
          title="Escolher outra"
          preset="secondary"
          isLoading={photo.isPicking}
          isDisabled={isRetrying}
          onPress={photo.pick}
        />
      </ScreenFooter>
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    gap: theme.space[16],
    paddingTop: theme.space[16],
  },
  centered: { textAlign: "center" },
});
