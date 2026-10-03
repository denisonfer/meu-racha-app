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
export const FINISH_EVENT_NOT_UNDONE = "Não dá para desfazer.";
export const FINISH_EVENT_REVIEWED = "Conferi, encerrar evento";
export const FINISH_EVENT_PAYMENTS_NOT_REVIEWED =
  "Confira os pagamentos na lista de Presença antes de encerrar.";
export const finishEventPaidSummary = (
  attended: number,
  paid: number,
  target: number | null
) =>
  `${attended} vieram · ${paid} pagaram · ${target == null ? "Meta não definida" : `Meta ${target}`}`;

/** Erro de encerrar evento → texto; só a conferência tem mensagem própria. */
export const finishEventErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message === "payments_not_reviewed"
    ? FINISH_EVENT_PAYMENTS_NOT_REVIEWED
    : ACTION_FAILED;

export const ATTENDANCE_EMPTY = "Ninguém confirmou ainda.";
export const ATTENDANCE_WAITLISTED = (position: number) =>
  `Você está na fila · posição ${position}.`;
export const ATTENDANCE_SPOT_LIMIT = "Não há vaga.";
export const ATTENDANCE_SPOT_LIMIT_BELOW_OCCUPANCY =
  "O limite não pode ser menor que o número de participantes confirmados.";
export const ATTENDANCE_EVENT_MONTH_LOCKED =
  "Este evento já tem pagamento registrado. Cancele e crie outro para mudar de mês.";
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
  "Pagar não garante vaga. Se não entrar, o valor pago pode virar Crédito.";
export const ATTENDANCE_CREDIT_ALREADY_USED =
  "Esse crédito já foi usado em outro Evento. A correção não foi aplicada.";
export const ATTENDANCE_PRESENT_PAYERS = (
  count: number,
  target: number | null
) =>
  target == null
    ? `Pagantes presentes: ${count} · Meta não definida`
    : `Pagantes presentes: ${count}/${target}`;
export const ATTENDANCE_CREDIT_BALANCE = (amount: number) =>
  `Crédito: R$ ${amount}`;
export const PAYER_TARGET_REQUIRED =
  "Informe a Meta de pagantes (quantos pagantes que vieram cobrem o dia).";
export const PAYER_TARGET_INVALID =
  "A Meta precisa ser um número maior que zero.";
export const ATTENDANCE_MONTHLY_HINT =
  "Cobertura do mês do Evento. Outubro não quita novembro.";
export const ATTENDANCE_MONTHLY_SAVE = "Salvar";
export const ATTENDANCE_GUEST_NAME_REQUIRED = "Como querem chamar o avulso?";
export const ATTENDANCE_GUEST_STARS_REQUIRED = "Escolha as Estrelas";
export const ATTENDANCE_GUEST_PRIMARY_REQUIRED = "Escolha a posição principal";
export const ATTENDANCE_GUEST_SECONDARY_REQUIRED =
  "Escolha uma secundária diferente da principal";

export const SORT_ROSTER_CHANGED = "A lista mudou. Sorteie novamente.";
export const SORT_NOT_CONDUCTOR = "Só quem está conduzindo pode fazer isso.";
export const SORT_NOT_MEMBER = "Você não faz mais parte deste racha.";
export const SORT_ALREADY_CONFIRMED = "Os times já foram confirmados.";
export const SORT_EVENT_NOT_UPCOMING =
  "Este evento já começou. Não dá mais para sortear.";
export const SORT_NOT_ENOUGH_PLAYERS =
  "Faltam jogadores de linha para sortear.";
export const SORT_NO_PROPOSAL =
  "Ainda não há times sorteados. Sorteie primeiro.";
export const SORT_GOALKEEPER_NOT_FOUND =
  "Esse goleiro não está mais no sorteio. Sorteie novamente.";
export const SORT_TEAM_FULL = "Esse time já está completo.";
export const SORT_PRESENCE_LOCKED =
  "Os times já foram sorteados. A presença não muda mais por aqui.";
export const SORT_NOT_CONFIRMED = "Os times ainda não foram confirmados.";
export const SORT_EVENT_NOT_ACTIVE = "Este evento não está em andamento.";
export const SORT_NOT_PARTICIPATING = "Só quem está jogando pode sair.";
export const SORT_ALREADY_PARTICIPATING = "Essa pessoa já está jogando.";
export const SORT_USE_RETURN = "Essa pessoa saiu. Use Voltar para trazê-la.";
export const SORT_NOT_LEFT = "Essa pessoa não saiu deste evento.";

/** Código de erro das RPCs do Sorteio → pt-BR; desconhecido cai em ACTION_FAILED. */
export function sortErrorMessage(code: string): string {
  switch (code) {
    case "roster_changed":
    case "proposal_outdated":
      return SORT_ROSTER_CHANGED;
    case "not_conductor":
      return SORT_NOT_CONDUCTOR;
    case "not_member":
      return SORT_NOT_MEMBER;
    case "already_confirmed":
      return SORT_ALREADY_CONFIRMED;
    case "event_not_upcoming":
      return SORT_EVENT_NOT_UPCOMING;
    case "not_enough_players":
      return SORT_NOT_ENOUGH_PLAYERS;
    case "no_proposal":
      return SORT_NO_PROPOSAL;
    case "goalkeeper_not_found":
      return SORT_GOALKEEPER_NOT_FOUND;
    case "team_full":
      return SORT_TEAM_FULL;
    case "sort_confirmed":
      return SORT_PRESENCE_LOCKED;
    case "sort_not_confirmed":
      return SORT_NOT_CONFIRMED;
    case "event_not_active":
      return SORT_EVENT_NOT_ACTIVE;
    case "not_confirmed":
      return SORT_NOT_PARTICIPATING;
    case "already_participating":
      return SORT_ALREADY_PARTICIPATING;
    case "use_return":
      return SORT_USE_RETURN;
    case "not_left":
      return SORT_NOT_LEFT;
    case "spot_limit":
      return ATTENDANCE_SPOT_LIMIT;
    default:
      return ACTION_FAILED;
  }
}

// --- Telas do Sorteio ---
export const SORT_TITLE = "Sorteio";
export const SORT_TEAMS_TITLE = "Times";
export const SORT_PREPARE = "Preparar sorteio";
export const SORT_RUN = "Sortear times";
export const SORT_RERUN = "Re-sortear";
export const SORT_CONFIRM_TEAMS = "Confirmar times";
export const SORT_VIEW_TEAMS = "Ver times";
export const SORT_TEAMS_DEFINED = "Times definidos";
export const SORT_NOT_PUBLISHED = "Ainda não publicado";
export const SORT_CONFIRMED_TITLE = "Sorteio confirmado";
export const SORT_PROPOSAL_TITLE = "Times sorteados";
export const SORT_PROPOSAL_SUBTITLE = "Confira o resultado antes de confirmar.";
export const SORT_PREPARE_HERO_TITLE = "Elenco de hoje";
export const SORT_PREPARE_HERO_TEXT =
  "O Sorteio considera só quem veio. Confira a Presença antes de formar os Times.";
export const SORT_MARK_ATTENDED_HINT =
  "Marque quem veio na lista de Presença antes de sortear.";
export const sortAttendanceSummary = (confirmed: number, attended: number) =>
  `${confirmed} confirmaram · ${attended} vieram`;
export const SORT_PREPARE_RULES_TITLE = "Como serão os Times";
export const SORT_PREPARE_HINT =
  "Quem ficar no Time incompleto será escolhido ao acaso uma vez para este elenco. Re-sortear só muda os Times completos.";
export const SORT_VIEW_ATTENDANCE = "Ver lista";
export const SORT_RULE_OUTFIELD = "Linha por Time";
export const SORT_RULE_BALANCE = "Equilíbrio";
export const SORT_BALANCE_STARS = "Estrelas";
export const SORT_BALANCE_STARS_POSITION = "Estrelas + Posição";
export const SORT_BALANCE_PROPOSAL = "Equilíbrio dos Times completos";
export const SORT_BALANCE_CONFIRMED = "Equilíbrio do Sorteio confirmado";
export const SORT_CONFIRM_NOTE = "Depois de confirmar, não dá para re-sortear.";
export const SORT_CONFIRM_SHEET_TITLE = "Publicar estes Times?";
export const SORT_CONFIRM_SHEET_TEXT =
  "Depois não será possível re-sortear. Todos os Membros passam a ver os Times.";
export const SORT_BACK = "Voltar";
export const SORT_SUPER_WARNING_TITLE = "Super Estrelas no mesmo Time";
export const SORT_GOALKEEPERS_TITLE = "Goleiros";
export const SORT_GOALKEEPERS_HINT =
  "Toque em um goleiro e depois em outro para trocá-los de lugar.";
export const SORT_GOALKEEPER_QUEUE = "Fila do gol";
export const SORT_WAITING_TITLE = "Aguardando inclusão";
export const SORT_LEFT_TITLE = "Saíram";
export const SORT_LEFT_DETAIL = "Saiu do jogo";
export const SORT_WAITING_NOT_ATTENDED = "Confirmou, não veio";
export const SORT_INCLUDE = "Incluir";
export const SORT_INCLUDE_PERSON = "Incluir pessoa";
export const SORT_RETURN = "Volta";
export const SORT_LEAVE_OTHER = "Marcar saída";
export const SORT_LEAVE_SELF = "Minha saída";
export const SORT_LEAVE_CONFIRM = "Registrar saída";
export const SORT_LEAVE_BUSY = "Registrando";
export const SORT_LEAVE_SELF_TITLE = "Registrar a sua saída?";
export const SORT_LEAVE_SELF_TEXT =
  "Você sai do Time. Só quem está conduzindo pode trazer você de volta.";
export const SORT_LEAVE_OTHER_TEXT =
  "A pessoa sai do Time. Só quem está conduzindo pode trazê-la de volta.";
export const SORT_INCLUDE_TITLE = "Incluir pessoa";
export const SORT_INCLUDE_MEMBERS = "Membros do racha";
export const SORT_INCLUDE_NO_MEMBERS = "Nenhum Membro disponível para incluir.";
export const SORT_INCLUDE_GUEST = "Adicionar avulso";
export const SORT_INCLUDE_BACK_TO_LIST = "Voltar à lista";
export const SORT_ASSUME_UPCOMING_TITLE = "Assumir a preparação?";
export const SORT_ASSUME_UPCOMING_STAY = "Continuar aqui";
export const SORT_NOT_READY_TITLE = "Os times ainda não foram sorteados";
export const SORT_NOT_READY_TEXT =
  "Quando quem conduz confirmar o sorteio, os times aparecem aqui.";
export const SORT_LOAD_FAILED_TITLE = "Não deu pra abrir o sorteio";
export const SORT_LOAD_FAILED_TEXT = "Confira a internet e tente de novo.";
export const SORT_RETRY = "Tentar de novo";
export const SORT_LOADING = "Carregando o sorteio";
export const SORT_LEFT_ATTENDANCE_NOTE =
  "Os times já foram definidos. Para sair do jogo, use a tela de Times.";

export const sortConductingLine = (name: string) =>
  `${name} está conduzindo o sorteio.`;
export const sortAssumeUpcomingText = (name: string) =>
  `${name} está conduzindo este evento. Quer assumir a preparação do Sorteio?`;
export const sortMissingLinePlayers = (missing: number) =>
  missing === 1
    ? "Falta 1 jogador de linha que veio para sortear."
    : `Faltam ${missing} jogadores de linha que vieram para sortear.`;
export const sortOutfieldPerTeam = (count: number) => `${count} jogadores`;
export const sortLineCountLabel = "na linha";
export const sortGoalkeeperCountLabel = (count: number) =>
  count === 1 ? "goleiro" : "goleiros";
export const sortTeamTitle = (teamNumber: number) => `Time ${teamNumber}`;
export const SORT_INCOMPLETE = "INCOMPLETO";
export const sortMissingToComplete = (missing: number) =>
  missing === 1
    ? "Falta 1 jogador para completar este Time."
    : `Faltam ${missing} jogadores para completar este Time.`;
export const sortLeaveOtherTitle = (name: string) =>
  `Registrar a saída de ${name}?`;
export const sortLeaveOtherLabel = (name: string) => `Marcar saída de ${name}`;
export const SORT_LEAVE_SELF_LABEL = "Registrar a minha saída";
export const sortIncludeLabel = (name: string) => `Incluir ${name}`;
export const sortReturnLabel = (name: string) => `Trazer ${name} de volta`;
export const sortSuperWarningText = (names: string) =>
  `Não foi possível separar ${names}.`;
export const sortGoalkeeperQueuePosition = (position: number) =>
  `Fila do gol · ${position}`;
export const sortWaitingTitle = (count: number) =>
  `${SORT_WAITING_TITLE} · ${count}`;
export const sortLeftTitle = (count: number) => `${SORT_LEFT_TITLE} · ${count}`;
export const sortScoreLabel = (score: number, label: string) =>
  `${Math.round(score)}%, ${label}`;

/** Erro de uma ação do Sorteio → texto; sem rede, o convite a tentar de novo. */
export function sortFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return code === "network_error"
    ? SORT_LOAD_FAILED_TEXT
    : sortErrorMessage(code);
}

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
