// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "ios/*", "android/*", ".expo/*"],
  },

  // --- Fronteiras da arquitetura -------------------------------------------
  // Em flat config o bloco posterior SUBSTITUI a configuração da regra, não
  // acrescenta. Por isso cada conjunto de arquivos declara um único
  // no-restricted-imports, com tudo o que vale ali dentro.

  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message:
                "Importe a feature pelo index.ts dela, nunca por dentro.",
            },
            {
              group: ["@supabase/*"],
              message: "Só src/lib e o api da feature falam com o Supabase.",
            },
          ],
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message: "Use o Text de @/ui/components.",
            },
            {
              name: "lucide-react-native",
              message:
                "Use o Icon de @/ui/components. Ícone novo entra no icon-map.ts.",
            },
          ],
        },
      ],
    },
  },

  {
    // As duas exceções: aqui o SDK pode entrar.
    files: ["src/lib/**/*.{ts,tsx}", "src/features/*/*-api.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  {
    // O design system é burro de propósito: não sabe o que é Racha.
    // Aqui o Text do react-native é permitido — é onde ele é embrulhado.
    files: ["src/ui/**/*.{ts,tsx}"],
    // o icon-map é o único lugar que pode falar com a lib de ícones
    ignores: ["src/ui/components/icon/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "ui/ não conhece feature. Suba o que for comum para ui/ ou lib/.",
            },
          ],
          paths: [
            {
              name: "lucide-react-native",
              message:
                "Só o icon-map.ts conhece a biblioteca de ícones. Adicione o ícone lá.",
            },
          ],
        },
      ],
    },
  },

  {
    // A fronteira dos ícones: aqui a lib entra. Continua sem conhecer feature.
    files: ["src/ui/components/icon/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message: "ui/ não conhece feature.",
            },
          ],
        },
      ],
    },
  },
]);
