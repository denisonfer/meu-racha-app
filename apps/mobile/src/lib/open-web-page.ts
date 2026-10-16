import * as WebBrowser from "expo-web-browser";
import { theme } from "@/ui/theme";

/**
 * Sai do código porque o endereço muda de mão: primeiro o subdomínio grátis do
 * Pages, depois o domínio próprio. O padrão é o domínio final para nenhuma
 * build sem env ficar com link morto.
 */
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? "https://meu-racha.pages.dev";

/**
 * Abre por cima do app, não no navegador do sistema: sair do app no meio do
 * cadastro é o caminho mais curto para a pessoa não voltar.
 */
export const openWebPage = (path: string) =>
  void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
    toolbarColor: theme.colors.background,
    controlsColor: theme.colors.action,
  });
