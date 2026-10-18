import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { theme } from "@/ui/theme";

export type TPixQrCodeProps = {
  value: string;
  /**
   * @default 232
   */
  size?: number;
  onError?: () => void;
};

// o cartão é branco nos dois temas: câmera e app de banco leem melhor escuro sobre claro
const CARD_BACKGROUND = "#FFFFFF";
const PADDING = theme.space[16];

export const PixQrCode = ({ value, size = 232, onError }: TPixQrCodeProps) => {
  const card = size + PADDING * 2;
  return (
    <View
      style={[styles.card, { width: card, height: card }]}
      accessibilityRole="image"
      accessibilityLabel="QR Code do PIX"
    >
      <QRCode
        value={value}
        size={size}
        ecl="M"
        color={theme.colors.background}
        backgroundColor={CARD_BACKGROUND}
        onError={onError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: PADDING,
    borderRadius: theme.radius.card,
    backgroundColor: CARD_BACKGROUND,
    alignSelf: "center",
  },
});
