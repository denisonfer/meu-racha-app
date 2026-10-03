import { Text } from "@/ui/components";

/** Falha da última ação do Sorteio; a tela só muda com a resposta do banco. */
export const SortFailure = ({ message }: { message: string }) => (
  <Text preset="small" color="errorText" accessibilityRole="alert">
    {message}
  </Text>
);
