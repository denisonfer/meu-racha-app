export const theme = {
  colors: {
    background: "#07180F", // fundo
    surface: "#0F2A1B", // cartão, campo
    action: "#C6F24E", // CTA
    actionPressed: "#A8D63A",
    onAction: "#07180F", // texto sobre o lima
    text: "#F4F6F1",
    muted: "#8C948D",
    border: "rgba(198, 242, 78, 0.12)",
    danger: "#EF4444",
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
    control: 12,
    card: 16,
    pill: 9999,
  },
  text: {
    h1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
    small: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
    button: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  },
  minTouch: 44,
} as const;

export type TThemeColor = keyof typeof theme.colors;
