export const SETTINGS_TITLE = "Configurações";
export const SETTINGS_NOTIFICATIONS = "Notificações";
export const SETTINGS_ABOUT = "Sobre";
export const SETTINGS_TERMS = "Termos de Uso";
export const SETTINGS_PRIVACY = "Política de Privacidade";
export const settingsVersion = (version: string) => `Versão ${version}`;
export const PUSH_ROW_LABEL = "Avisos no celular";
export const PUSH_ROW_ON =
  "Vale para todos os seus rachas. A aba Avisos sempre recebe tudo.";
export const PUSH_ROW_OFF =
  "Os avisos continuam chegando na aba Avisos, só sem notificação no celular.";
// o NoticeBanner só mostra a ação com título
export const PUSH_DENIED_TITLE = "Sem avisos no celular";
export const PUSH_DENIED_SETTINGS_TEXT =
  "As notificações estão desligadas nos ajustes do celular.";
export const PUSH_OPEN_SETTINGS = "Abrir Ajustes";
export const PUSH_UNASKED_TITLE = "Sem avisos neste celular";
export const PUSH_UNASKED_TEXT =
  "Permita as notificações para receber os avisos aqui também.";
export const PUSH_UNASKED_ACTION = "Permitir notificações";
export const PUSH_SAVE_FAILED = "Não foi possível salvar. Tente de novo.";
export const SETTINGS_ACCOUNT = "Conta";
export const DELETE_ACCOUNT = "Apagar conta";
export const DELETE_ACCOUNT_HINT = "Abre a confirmação";
export const DELETE_ACCOUNT_TITLE = "Apagar sua conta?";
export const DELETE_ACCOUNT_TEXT = "É na hora e não tem volta.";
export const DELETE_ACCOUNT_LOSE = "Você perde";
export const DELETE_ACCOUNT_LOSE_ACCESS = "Sua conta e o acesso ao app";
export const DELETE_ACCOUNT_LOSE_PHOTO = "Sua foto e seus avisos";
export const deleteAccountLoseRachas = (n: number) =>
  n === 1
    ? "Seu lugar no racha em que você está"
    : `Seu lugar nos ${n} rachas em que você está`;
export const DELETE_ACCOUNT_KEEP = "Fica nos rachas";
export const DELETE_ACCOUNT_KEEP_STATS =
  "Seus gols e vitórias no histórico, com o nome “Conta apagada”";
export const DELETE_ACCOUNT_CONFIRM = "Apagar conta";
export const DELETE_ACCOUNT_BUSY = "Apagando";
export const DELETE_ACCOUNT_FAILED =
  "Não foi possível apagar a conta. Tente de novo.";
export const DELETE_ACCOUNT_CHECK_FAILED =
  "Não deu pra verificar sua conta. Confira a internet e tente de novo.";
export const DELETE_ACCOUNT_BLOCKED_TITLE = "Ainda não dá para apagar";
export const DELETE_ACCOUNT_BLOCKED_TEXT =
  "Resolva antes o que está abaixo e volte aqui.";
export const deleteAccountOwnerTitle = (n: number) =>
  n === 1 ? "Você é dono de 1 racha" : `Você é dono de ${n} rachas`;
export const DELETE_ACCOUNT_OWNER_HINT =
  "Passe o racha a outro membro ou exclua o racha.";
export const DELETE_ACCOUNT_CONDUCTOR_TITLE = "Você está conduzindo um evento";
export const DELETE_ACCOUNT_CONDUCTOR_HINT =
  "Passe a condução ou encerre o evento.";
export const ACCOUNT_DELETED = "Sua conta foi apagada.";
export const DELETED_ACCOUNT_NAME = "Conta apagada";
export const deleteAccountMemberCount = (n: number) =>
  n === 1 ? "1 membro" : `${n} membros`;
export const DELETE_ACCOUNT_RETRY = "Tentar de novo";
export const SETTINGS_SAFETY = "Segurança e ajuda";
export const BLOCKED_PEOPLE = "Pessoas bloqueadas";
export const BLOCKED_PEOPLE_TEXT =
  "Quem você bloqueou some para você de Membros, Ranking e Resenha. Nas telas do jogo continua aparecendo.";
export const BLOCKED_NO_SHARED_RACHA = "Nenhum racha em comum";
export const BLOCKED_EMPTY = "Você não bloqueou ninguém";
export const BLOCKED_EMPTY_TEXT =
  "Para bloquear alguém, abra a pessoa em Membros e toque na bandeira.";
export const BLOCKED_LOAD_FAILED = "Não deu pra abrir as pessoas bloqueadas";
export const BLOCKED_LOAD_FAILED_TEXT = "Confira a internet e tente de novo.";
export const BLOCKED_RETRY = "Tentar de novo";
export const UNBLOCK = "Desbloquear";
export const CONTACT_US = "Fale conosco";
export const CONTACT_EMAIL = "denison91.dev@gmail.com";
export const CONTACT_COPIED = "E-mail copiado.";
