import { Share } from "react-native";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://meuracha.app";

export const shareInvite = (rachaName: string, inviteCode: string) =>
  void Share.share({
    message: `Entra no ${rachaName} no Meu Racha: ${WEB_URL}/r/${inviteCode}\nCódigo do racha: ${inviteCode}`,
  });
