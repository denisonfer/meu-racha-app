export const NOTIFICATIONS_TITLE = "Avisos";
export const NOTIFICATIONS_NEW = "Novos";
export const NOTIFICATIONS_TODAY = "Hoje";
export const NOTIFICATIONS_YESTERDAY = "Ontem";
export const NOTIFICATIONS_THIS_WEEK = "Esta semana";
export const NOTIFICATIONS_EARLIER = "Antes";
export const NOTIFICATIONS_RETENTION = "Avisos vistos ficam aqui por 7 dias.";
export const NOTIFICATIONS_EMPTY = "Nenhum aviso ainda";
export const NOTIFICATIONS_EMPTY_TEXT =
  "Pedidos para entrar, Eventos, Times e Créditos dos seus Rachas aparecem aqui.";
export const NOTIFICATIONS_LOADING = "Carregando os Avisos";
export const NOTIFICATIONS_LOAD_FAILED = "Não deu pra abrir os Avisos";
export const NOTIFICATIONS_LOAD_FAILED_TEXT =
  "Confira a internet e tente de novo.";
export const NOTIFICATIONS_RETRY = "Tentar de novo";
export const NOTIFICATIONS_GONE_EVENT = "Este Evento foi cancelado";
export const NOTIFICATIONS_GONE_RACHA = "Este Racha foi excluído";
export const NOTIFICATIONS_GONE_MEMBER = "Você não está mais neste Racha";

export const notificationsMeta = (racha: string, when: string) =>
  `${racha} · ${when}`;

export const requestResolved = (
  approved: boolean,
  byName: string,
  byMe: boolean
) => `${approved ? "Aprovado" : "Recusado"} por ${byMe ? "você" : byName}`;

export const tabBadgeA11y = (label: string, count: number) =>
  count > 9
    ? `${label}, mais de 9 avisos novos`
    : `${label}, ${count} ${count === 1 ? "aviso novo" : "avisos novos"}`;
