// O domínio é puro: roda no Hermes (app), no Deno (Edge Function) e no Node/bun (testes).
// Esta config é quem cobra essa pureza — não a disciplina de quem escreve.
//
// .mjs porque o package.json deste pacote é "type": "module".

import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["node_modules/**"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "react", "react-*",
            "react-native", "react-native-*",
            "expo", "expo-*", "@expo/*",
            "@supabase/*",
            "node:*",
          ],
          message:
            "domain é puro: sem framework, sem SDK, sem Node. Ele roda no Hermes, no Deno e no Node.",
        }],
      }],
    },
  },
];
