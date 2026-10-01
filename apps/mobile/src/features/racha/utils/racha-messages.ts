import {
  ADMIN_LIMIT_FREE,
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  MIN_AGE_MAX,
  MIN_AGE_MIN,
  RACHA_NAME_MIN,
} from "@meu-racha/domain";

/**
 * Todo pt-BR de erro do Racha mora aqui; a api fala em código, a tela fala em
 * português.
 */
export const NAME_REQUIRED =
  "Falta o nome do racha. Digite um nome para criar.";
export const NAME_TOO_SHORT = `Mínimo de ${RACHA_NAME_MIN} caracteres.`;
export const NAME_INVALID = "Use letras e números, começando por letra.";
export const MATCH_DURATION_INVALID = `De ${MATCH_DURATION_MIN} a ${MATCH_DURATION_MAX} minutos, ou Sem relógio.`;
export const MIN_AGE_INVALID = `De ${MIN_AGE_MIN} a ${MIN_AGE_MAX} anos, ou Sem idade mínima.`;

export const PLAN_OWNER_LIMIT =
  "No plano grátis você pode ser dono de 1 racha. O Pro chega em breve.";

export const CREATE_RACHA_FAILED =
  "Não criou o racha. Toque em Criar racha para tentar de novo.";

export const isPlanOwnerLimit = (code: string | null) =>
  code === "plan_owner_limit";

export const INVITE_CODE_INVALID =
  "Código inválido. Confira com quem te convidou.";
export const INVITE_CHECK_FAILED =
  "Não deu pra verificar. Confira a internet e toque em Continuar de novo.";
export const REQUEST_JOIN_FAILED =
  "Não enviou o pedido. Toque em Solicitar entrada para tentar de novo.";
export const CANCEL_JOIN_REQUEST_FAILED =
  "Não cancelou o pedido. Toque em Cancelar pedido para tentar de novo.";
export const JOIN_REQUEST_CANCELLED = "Pedido cancelado.";
export const JOIN_REQUEST_ALREADY_ANSWERED = "Este pedido já foi respondido.";

export const JOIN_REQUEST_APPROVED = (name: string) =>
  `${name} entrou no racha.`;
export const JOIN_REQUEST_REFUSED = "Pedido recusado.";
export const JOIN_REQUEST_ALREADY_RESOLVED = "Este pedido já foi resolvido.";
export const APPROVE_NOW_OUTFIELD =
  "Esta pessoa agora joga na linha. Escolha as Estrelas.";
export const JOIN_REQUEST_ACTION_FAILED =
  "Não deu pra concluir. Confira a internet e tente de novo.";

export const NAME_REQUIRED_TO_SAVE =
  "Falta o nome do racha. Digite um nome para salvar.";
export const RACHA_SAVED = "Alterações salvas.";
export const SAVE_RACHA_FAILED =
  "Não salvou. Toque em Salvar para tentar de novo.";
export const DISCARD_CHANGES_TITLE = "Descartar alterações?";
export const RACHA_DELETED = "Racha excluído.";
export const DELETE_RACHA_FAILED = JOIN_REQUEST_ACTION_FAILED;
export const NOT_OWNER = "Só o dono pode mudar o racha.";

export const ADMIN_LIMIT_HINT = `Até ${ADMIN_LIMIT_FREE} admins no plano grátis.`;
export const ADMIN_LIMIT_REACHED = `Já são ${ADMIN_LIMIT_FREE} admins, o máximo no plano grátis.`;
export const MEMBER_SAVED = RACHA_SAVED;
export const SAVE_MEMBER_FAILED = SAVE_RACHA_FAILED;
export const MEMBER_EXPELLED = (name: string) =>
  `${name} foi removido do racha.`;
export const MEMBER_GONE = "Este membro não está mais no racha.";
export const REQUESTS_NOT_ALLOWED =
  "Você não pode mais responder pedidos neste racha.";
export const MEMBER_NOT_ALLOWED = "Você não pode mais mudar este membro.";
export const OWNERSHIP_TRANSFERRED = (name: string) =>
  `${name} agora é o dono do racha.`;
export const TRANSFER_PLAN_LIMIT = (name: string) =>
  `${name} já é dono de outro racha. No plano grátis, cada pessoa é dona de um só.`;
export const OWNER_HINT_TO_LEAVE =
  "Para sair do racha, passe ele para outro membro em Membros.";
export const OWNER_CANNOT_LEAVE =
  "Você agora é o dono. Para sair, passe o racha para outro membro.";
export const NOTICE_OWNERSHIP_RECEIVED = "Você agora é o dono deste racha.";
export const LEFT_RACHA = "Você saiu do racha.";
export const ACTION_FAILED = JOIN_REQUEST_ACTION_FAILED;
export const NOTICE_RACHA_DELETED = "O dono excluiu este racha.";
export const NOTICE_REMOVED =
  "Você não faz mais parte deste racha. Se quiser voltar, peça de novo com o código.";

export const PLACE_REQUIRED = "Informe o local.";
export const PLACE_TOO_LONG = "Máximo de 120 caracteres.";
export const KICKOFF_REQUIRED = "Informe o horário.";
export const WEEKDAY_REQUIRED = "Escolha o dia.";
export const HOUR_INVALID = "De 0 a 23.";
export const MINUTE_INVALID = "De 0 a 59.";
export const PRICE_REQUIRED = "Informe o valor.";
export const PRICE_INVALID = "De 1 a 9999 reais.";
export const MONTHLY_PRICE_INVALID = "De 1 a 9999 reais, ou vazio.";
export const spotLimitTooSmall = (floor: number) =>
  `O limite precisa ser de pelo menos ${floor}, o dobro da linha por time.`;
export const LINE_TOO_BIG_FOR_SPOT_LIMIT =
  "O limite de vagas ficou pequeno para essa linha. Aumente ou apague o limite na logística.";
export const PIX_LOCKED = "Confirme seu e-mail para cadastrar a chave PIX.";
export const LOGISTICS_NOT_ALLOWED =
  "Você não pode mais mudar a logística deste racha.";
export const SLOT_HINT = "Os dois ou nenhum. Vazio: o racha não é recorrente.";
export const PRICE_HINT = "Reais inteiros, no mínimo 1.";
export const MONTHLY_PRICE_HINT = "Sem ele, o racha não tem mensalista.";
export const SPOT_LIMIT_HINT = "Opcional. No mínimo o dobro da linha por time.";
export const SPOT_LIMIT_TOO_BIG = "No máximo 32767.";
