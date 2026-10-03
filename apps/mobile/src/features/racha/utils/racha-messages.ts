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

export const EVENT_PLACE_REQUIRED = "Informe o local deste jogo.";
export const EVENT_DATE_PAST = "A data não pode ser no passado.";
export const EVENT_TIME_PAST = "O horário precisa ser no futuro.";
export const EVENT_START_PAST = "Escolha uma data e um horário futuros.";
export const EVENT_DATE_INVALID = "Confira a data.";
export const eventSpotLimitTooSmall = (floor: number) => `O mínimo é ${floor}.`;
export const MOTOR_LOCKED =
  "O motor fica travado enquanto o evento está em curso. Encerre o evento para mudar.";
export const DELETE_LOCKED =
  "Encerre o evento em andamento para excluir o racha.";
export const CONDUCTOR_CANNOT_LEAVE =
  "Passe a condução ou encerre o evento para sair do racha.";
export const conductorName = (name: string) => `${name} está conduzindo.`;
export const EVENT_NOT_ALLOWED = "Você não pode mais editar este evento.";
export const CANCEL_EVENT_TITLE = "Cancelar este evento?";
export const FINISH_EVENT_TITLE = "Encerrar este evento?";

export const ATTENDANCE_EMPTY = "Ninguém confirmou ainda.";
export const ATTENDANCE_WAITLISTED = (position: number) =>
  `Você está na fila · posição ${position}.`;
export const ATTENDANCE_SPOT_LIMIT = "Não há vaga.";
export const ATTENDANCE_SPOT_LIMIT_BELOW_OCCUPANCY =
  "O limite não pode ser menor que o número de participantes confirmados.";
export const ATTENDANCE_EVENT_MONTH_LOCKED =
  "Este evento já tem pagamento registrado. Cancele e crie outro para mudar de mês.";
export const ATTENDANCE_WAITLISTED_UNPAID =
  "O pagamento na fila estará disponível com o Crédito da lista de espera.";
export const ATTENDANCE_MENSALISTA_PAID =
  "Mensalista permanece como pago neste mês.";
export const ATTENDANCE_MONTHLY_PRICE_REQUIRED =
  "Configure o valor mensal na logística para marcar Mensalista.";
export const ATTENDANCE_NOT_CONFIRMED =
  "Só quem está confirmado pode marcar veio ou pagou.";
export const ATTENDANCE_GUEST_AGE_NOTICE =
  "A idade mínima do Racha não é verificada para Avulso.";
export const ATTENDANCE_CONFIRM = "Confirmar presença";
export const ATTENDANCE_CANCEL = "Cancelar presença";
export const ATTENDANCE_LEAVE_QUEUE = "Sair da fila";
export const ATTENDANCE_VIEW_LIST = "Ver lista";
export const ATTENDANCE_MONTHLY_ACTION = "Mensalista";
export const ATTENDANCE_ADD_GUEST = "Adicionar avulso";
export const ATTENDANCE_REMOVE_GUEST = "Remover";
export const ATTENDANCE_REMOVE_GUEST_TITLE = (name: string) =>
  `Remover ${name}?`;
export const ATTENDANCE_REMOVE_GUEST_MESSAGE =
  "A vaga abre e quem estiver na fila pode entrar.";
export const ATTENDANCE_REMOVE_GUEST_BUSY = "Removendo";
export const ATTENDANCE_GUEST_GONE = "Esse avulso já não está na lista.";
export const ATTENDANCE_EVENT_GONE_TITLE = "Sumiu";
export const ATTENDANCE_EVENT_GONE_TEXT =
  "Este evento não está mais na agenda. Volte para a home do racha.";
export const ATTENDANCE_EVENT_GONE_ACTION = "Voltar ao racha";
export const ATTENDANCE_QUEUE_PAY_NOTE =
  "Pagamento de quem está na fila fica para a etapa de Caixa.";
export const ATTENDANCE_MONTHLY_HINT =
  "Cobertura do mês do Evento. Outubro não quita novembro.";
export const ATTENDANCE_MONTHLY_SAVE = "Salvar";
export const ATTENDANCE_GUEST_NAME_REQUIRED = "Como querem chamar o avulso?";
export const ATTENDANCE_GUEST_STARS_REQUIRED = "Escolha as Estrelas";
export const ATTENDANCE_GUEST_PRIMARY_REQUIRED = "Escolha a posição principal";
export const ATTENDANCE_GUEST_SECONDARY_REQUIRED =
  "Escolha uma secundária diferente da principal";

/** Contagem clicável do cartão (telas 7 e 9). */
export const ATTENDANCE_CONFIRMED_COUNT = (count: number) =>
  count === 1 ? "1 confirmado" : `${count} confirmados`;

/** Posição na fila no cartão — distinto do toast de entrada. */
export const ATTENDANCE_QUEUE_HINT = (position: number) =>
  `Fila · posição ${position}`;

const YEAR_MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** `2026-11` → `novembro de 2026` */
export const yearMonthLong = (yearMonth: string): string => {
  const [year, month] = yearMonth.split("-");
  const name = YEAR_MONTH_NAMES[Number(month) - 1];
  if (!year || !name) return yearMonth;
  return `${name} de ${year}`;
};

export const monthlyPassChipLabel = (yearMonth: string) =>
  `Mensalista · ${yearMonthLong(yearMonth)}`;

/** Ex.: `R$ 15 crédito + R$ 10` — valores em reais inteiros do fato. */
export const attendancePaymentNote = (
  creditApplied: number | null,
  cashPaid: number | null
): string | null => {
  const parts: string[] = [];
  if (creditApplied != null && creditApplied > 0) {
    parts.push(`R$ ${creditApplied} crédito`);
  }
  if (cashPaid != null && cashPaid > 0) {
    parts.push(`R$ ${cashPaid}`);
  }
  return parts.length > 0 ? parts.join(" + ") : null;
};
