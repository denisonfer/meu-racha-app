import type {
  TProfileReportReason,
  TRachaReportReason,
} from "../moderation-types";

export const ACTION_REPORT = "Denunciar";
export const ACTION_BLOCK = "Bloquear";
export const ACTION_UNBLOCK = "Desbloquear";
export const actionBlockHint = (first: string) =>
  `Some para você, ${first} não fica sabendo`;
export const ACTION_UNBLOCK_HINT = "Volta a aparecer para você";
export const reportTitle = (name: string) => `Denunciar ${name}`;
export const reportProfileText = (first: string) =>
  `A equipe do Meu Racha analisa em até 24h. ${first} não fica sabendo que foi você.`;
export const REPORT_RACHA_TEXT = "A equipe do Meu Racha analisa em até 24h.";
export const REPORT_REASON = "Motivo";
export const REPORT_REASONS_PROFILE: Record<TProfileReportReason, string> = {
  photo: "Foto imprópria",
  name: "Nome ofensivo",
  harassment: "Assédio ou ameaça",
  spam_scam: "Spam ou golpe",
  other: "Outro motivo",
};
export const REPORT_REASONS_RACHA: Record<TRachaReportReason, string> = {
  name: "Nome ofensivo",
  scam_charge: "Golpe ou cobrança indevida",
  other: "Outro motivo",
};
export const REPORT_DETAILS = "Detalhes";
export const REPORT_DETAILS_SUFFIX = "(opcional)";
export const REPORT_DETAILS_PLACEHOLDER = "O que aconteceu?";
export const REPORT_SEND = "Enviar denúncia";
export const REPORT_SENDING = "Enviando";
export const REPORT_FAILED =
  "Não foi possível enviar a denúncia. Tente de novo.";
export const REPORT_SENT = "Denúncia enviada";
export const REPORT_SENT_PROFILE =
  "A equipe vai analisar em até 24h e pode remover a foto ou o nome.";
export const REPORT_SENT_RACHA =
  "A equipe vai analisar em até 24h e pode mudar o nome do racha.";
export const reportSentBlockAsk = (first: string) =>
  `Quer parar de ver ${first} em Membros, Ranking e Resenha?`;
export const reportSentBlockAction = (first: string) => `Bloquear ${first}`;
export const CLOSE = "Fechar";
export const blockTitle = (name: string) => `Bloquear ${name}?`;
export const blockText = (first: string) =>
  `${first} some para você de Membros, Ranking e Resenha. Nas telas do jogo continua aparecendo. ${first} não fica sabendo, e você pode desbloquear em Configurações.`;
export const BLOCK_CONFIRM = "Bloquear";
export const BLOCK_BUSY = "Bloqueando";
export const BLOCK_FAILED = "Não foi possível bloquear. Tente de novo.";
export const UNBLOCK_FAILED = "Não foi possível desbloquear. Tente de novo.";
export const blocked = (name: string) => `${name} bloqueado.`;
export const unblocked = (name: string) => `${name} desbloqueado.`;
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
