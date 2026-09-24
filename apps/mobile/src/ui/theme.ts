export const theme = {
  colors: {
    background: "#07180F", // fundo
    surface: "#0F2A1B", // cartão, campo
    foreground: "#F4F6F1", // texto principal e CTA secundário
    foregroundPressed: "#E1E3E0",
    action: "#C6F24E", // CTA
    actionPressed: "#A8D63A",
    onAction: "#07180F", // texto sobre o lima
    onActionPressed: "#05130B",
    muted: "#8C948D",
    border: "rgba(198, 242, 78, 0.12)",
    danger: "#EF4444",
    dangerPressed: "#B93333",
  },
  space: {
    4: 4,
    8: 8,
    16: 16,
    24: 24,
    32: 32,
    40: 40,
    48: 48,
  },
  radius: {
    check: 6,
    control: 12,
    card: 16,
    pill: 9999,
  },
  text: {
    // Texto: Manrope
    h1: {
      fontFamily: "Manrope-Bold",
      fontSize: 28,
      lineHeight: 34,
    },
    h2: {
      fontFamily: "Manrope-Bold",
      fontSize: 22,
      lineHeight: 28,
    },
    h3: {
      fontFamily: "Manrope-Bold",
      fontSize: 18,
      lineHeight: 24,
    },
    body: {
      fontFamily: "Manrope-Medium",
      fontSize: 16,
      lineHeight: 24,
    },
    small: {
      fontFamily: "Manrope-Medium",
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: "Manrope-Medium",
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.24, // os 2% do token, em pontos
    },
    button: {
      fontFamily: "Manrope-Bold",
      fontSize: 16,
      lineHeight: 20,
    },
    // A palavra "racha" escrita como texto (o logo em si é imagem)
    wordmark: {
      fontFamily: "Manrope-ExtraBold",
      fontSize: 28,
      lineHeight: 34,
    },
    // Números: Barlow Condensed
    score: {
      fontFamily: "BarlowCondensed-Bold",
      fontSize: 64,
      lineHeight: 64,
    },
    overall: {
      fontFamily: "BarlowCondensed-Bold",
      fontSize: 48,
      lineHeight: 48,
    },
    stat: {
      fontFamily: "BarlowCondensed-Bold",
      fontSize: 28,
      lineHeight: 32,
    },
  },
  minTouch: 44,
} as const;

export type TThemeColor = keyof typeof theme.colors;
export type TThemeTextPreset = keyof typeof theme.text;
