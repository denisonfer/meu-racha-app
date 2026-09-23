// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "ios/*", "android/*", ".expo/*"],
  },

  // --- Fronteiras da arquitetura -------------------------------------------
  // Em flat config, o bloco que vem depois vence. A ordem abaixo importa.

  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/features/*/*"],
            message: "Importe a feature pelo index.ts dela, nunca por dentro.",
          },
          {
            group: ["@supabase/*"],
            message: "Só src/lib e o api.ts de cada feature falam com o Supabase.",
          },
        ],
      }],
    },
  },

  {
    // As duas exceções: aqui o SDK pode entrar.
    files: ["src/lib/**/*.{ts,tsx}", "src/features/*/api.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  {
    // O design system é burro de propósito: não sabe o que é Racha.
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/*"],
          message: "ui/ não conhece feature. Suba o que for comum para ui/ ou lib/.",
        }],
      }],
    },
  },
]);
