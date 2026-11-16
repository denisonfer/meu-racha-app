import type { TIconName } from "@/ui/components";

export const PRO_TITLE = "Pro";
export const PRO_HERO = "O app lembra a turma por você.";
export const PRO_HERO_TEXT =
  "O jogo continua grátis. O Pro é para quem organiza.";
export const PRO_BENEFITS_OFFER = "O que o Pro faz";
export const PRO_BENEFITS_ACTIVE = "Ativo nos seus rachas";
export const PRO_SCOPE = "Vale para os rachas em que você é dono.";
export const PRO_SOON = "Em breve";

export type TProBenefit = {
  icon: TIconName;
  title: string;
  text: string;
  // nenhum Lembrete existe nesta versão; a spec 2 tira a marca
  isSoon: boolean;
};

export const PRO_BENEFITS: TProBenefit[] = [
  {
    icon: "notification",
    title: "Lembrete de Presença",
    text: "O app avisa quem ainda não respondeu, 24h antes do jogo.",
    isSoon: true,
  },
  {
    icon: "receipt",
    title: "Lembrete de pagamento",
    text: "O app avisa quem ficou devendo.",
    isSoon: true,
  },
  {
    icon: "racha",
    title: "Mais de um racha",
    text: "Seja dono de quantos quiser.",
    isSoon: false,
  },
  {
    icon: "users",
    title: "Admins sem limite",
    text: "No grátis são até 2.",
    isSoon: false,
  },
];

export const PRO_PLAN = "Plano";
export const PRO_MONTHLY = "Mensal";
export const PRO_ANNUAL = "Anual";
export const proPerMonth = (price: string) => `${price} por mês`;
export const proPerYearShort = (price: string) => `${price} por ano`;
export const proPerYear = (price: string, perMonth: string) =>
  `${price} por ano, o mesmo que ${perMonth} por mês`;
export const proSaving = (saving: string) =>
  `${saving} a menos que 12 meses no Mensal`;
export const proTrialCta = (days: number) => `Começar ${days} dias grátis`;
export const PRO_SUBSCRIBE = "Assinar";
// price = "R$ 9,90 por mês"
export const proAfterTrial = (price: string) =>
  `Depois, ${price}. Cancele quando quiser na Google Play.`;
export const proRenews = (price: string) =>
  `Renova sozinho por ${price}. Cancele quando quiser na Google Play.`;
export const PRO_LOADING = "Carregando os preços";
export const PRO_UNAVAILABLE = "Não foi possível carregar a assinatura agora.";
export const PRO_RETRY = "Tentar de novo";
export const PRO_BUYING = "Abrindo a Google Play";
export const PRO_ACTIVATING = "Ativando seu Pro";
export const PRO_ACTIVATING_TEXT =
  "A Google Play aprovou a compra. Falta a confirmação aqui, leva alguns segundos.";
export const PRO_SLOW = "Sua compra foi feita, mas ainda não confirmamos.";
export const PRO_SLOW_TEXT =
  "Ela está registrada na sua conta da Google Play e não se perde. Toque em Tentar de novo. Se continuar, fale com a gente.";
export const PRO_DECLINED =
  "A Google Play não concluiu a compra. Nada foi cobrado.";
export const PRO_RESTORE = "Restaurar compra";
export const PRO_RESTORE_NONE =
  "Nenhuma assinatura encontrada nesta conta da Google Play.";
export const PRO_RESTORE_FAILED =
  "Não foi possível restaurar agora. Tente de novo.";
export const PRO_TERMS_SHORT = "Termos";
export const PRO_PRIVACY_SHORT = "Privacidade";
export const PRO_YOUR_SUBSCRIPTION = "Sua assinatura";
export const proStatusTrial = (date: string) => `Em teste até ${date}.`;
export const proStatusRenews = (date: string) => `Pro. Renova em ${date}.`;
export const proStatusEnds = (date: string) => `Pro até ${date}. Não renova.`;
export const proStatusUntil = (date: string) => `Pro até ${date}.`;
export const PRO_REACTIVATE_HINT =
  "Para continuar depois, reative em Gerenciar na Google Play.";
export const PRO_BILLING_TITLE = "A Google Play não conseguiu cobrar.";
export const PRO_BILLING_TEXT =
  "Atualize a forma de pagamento para manter o Pro.";
export const PRO_BILLING_ACTION = "Atualizar pagamento na Google Play";
export const PRO_MANAGE = "Gerenciar na Google Play";
export const PRO_IOS_UNAVAILABLE = "O Pro ainda não está disponível no iPhone.";

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});
// datas da assinatura em dd/MM, no fuso de Brasília
export const planDate = (date: Date) => SHORT_DATE.format(date);

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export const brlFromMicros = (micros: number) => BRL.format(micros / 1e6);
