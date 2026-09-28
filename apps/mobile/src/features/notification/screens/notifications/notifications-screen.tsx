import { EmptyState, Screen } from "@/ui/components";

export const NotificationsScreen = () => (
  <Screen title="Avisos" hasTabBar>
    <EmptyState
      title="Nenhum aviso ainda"
      text="Pedidos de entrada, Eventos e Sorteios aparecem aqui."
    />
  </Screen>
);
