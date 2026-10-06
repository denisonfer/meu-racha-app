import {
  ADMIN_LIMIT_FREE,
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  YELLOW_OUT_MAX,
  YELLOW_OUT_MIN,
  MIN_AGE_MAX,
  MIN_AGE_MIN,
  RACHA_NAME_MIN,
} from "@meu-racha/domain";
import { joinNames } from "./sort-view";

/**
 * Todo pt-BR de erro do Racha mora aqui; a api fala em código, a tela fala em
 * português.
 */
export const NAME_REQUIRED =
  "Falta o nome do racha. Digite um nome para criar.";
export const NAME_TOO_SHORT = `Mínimo de ${RACHA_NAME_MIN} caracteres.`;
export const NAME_INVALID = "Use letras e números, começando por letra.";
export const MATCH_DURATION_INVALID = `De ${MATCH_DURATION_MIN} a ${MATCH_DURATION_MAX} minutos, ou Sem relógio.`;
export const YELLOW_OUT_INVALID = `De ${YELLOW_OUT_MIN} a ${YELLOW_OUT_MAX} minutos.`;
export const yellowShorterThanMatch = (durationMin: number) =>
  `O amarelo precisa ser menor que a Duração da partida (${durationMin} min).`;
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

// --- Subdivisão de posição (Times de 8+ na linha) ---
export const POSITION_DETAIL_REQUIRED =
  "Escolha a subdivisão de cada posição para continuar.";
export const POSITION_DETAIL_MISMATCH =
  "A posição mudou enquanto você escolhia. Confira e tente de novo.";
export const POSITION_DETAIL_SAVE_FAILED =
  "Não salvou a posição. Toque em Salvar para tentar de novo.";
export const POSITION_DETAIL_SAVED = "Posição salva";
export const POSITION_DETAIL_BLOCKED =
  "Complete as posições pendentes para sortear.";
export const POSITION_DETAIL_GUEST_HINT =
  "A subdivisão do Avulso vale só para este Evento.";
export const POSITION_DETAIL_PROFILE_HINT =
  "Isso vale só para este Racha. Seu Perfil não muda. Para trocar a posição ampla, edite o Perfil.";
export const POSITION_DETAIL_JOIN_TEXT =
  "Neste Racha, defesa e meio-campo se dividem. Diga onde você joga em cada um.";
export const positionDetailJoinKicker = (outfieldPerTeam: number) =>
  `${outfieldPerTeam} na linha por Time`;
export const POSITION_DETAIL_LOAD_FAILED =
  "Não deu pra ler as posições do seu Perfil.";
export const POSITION_DETAIL_MEMBER_HINT =
  "Zonas do Perfil. Só a subdivisão é deste Racha.";
export const POSITION_DETAIL_SECTION = "Posição neste Racha";
export const POSITION_DETAIL_COMPLETE = "Completar";
export const POSITION_DETAIL_SELF_TITLE = "Complete sua posição.";
export const POSITION_DETAIL_PENDING_GROUP = "Posição pendente";
export const POSITION_DETAIL_PRESENCE_TEXT =
  "O Sorteio não sai enquanto quem veio estiver pendente.";
export const positionDetailSelfText = (outfieldPerTeam: number) =>
  `Este Racha tem ${outfieldPerTeam} na linha por Time e divide defesa e meio-campo.`;
export const POSITION_DETAIL_SHEET_TITLE = "Sua posição neste Racha";
export const POSITION_DETAIL_SHEET_TEXT = "Seu Perfil não muda.";
export const positionDetailPendingTitle = (count: number) =>
  count === 1
    ? "1 jogador sem subdivisão."
    : `${count} jogadores sem subdivisão.`;
export const POSITION_DETAIL_SORT_TEXT =
  "Eles vieram e precisam completar a posição antes do Sorteio.";
export const positionDetailMemberPending = (name: string) =>
  `Sem a subdivisão, ${name} não entra no Sorteio quando vier.`;
/** Erro junto ao seletor: as duas opções da zona. */
export const positionDetailChoose = (labels: string[]) =>
  `Escolha ${labels.join(" ou ")} para continuar.`;
export const positionDetailCompleteLabel = (name: string) =>
  `Completar a posição de ${name}`;
/** position_detail_pending: o banco manda os nomes de quem veio e está pendente. */
export const positionDetailPendingMessage = (names: string[]) =>
  names.length === 0
    ? "Há jogadores com a posição pendente. Complete antes de sortear."
    : names.length === 1
      ? `${names[0]} está com a posição pendente. Complete antes de sortear.`
      : `${joinNames(names)} estão com a posição pendente. Complete antes de sortear.`;

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
    case "position_detail_required":
      return POSITION_DETAIL_REQUIRED;
    case "position_detail_mismatch":
      return POSITION_DETAIL_MISMATCH;
    case "position_detail_pending":
      return positionDetailPendingMessage([]);
    default:
      return ACTION_FAILED;
  }
}

/** Nomes do detail de position_detail_pending; vazio para qualquer outro erro. */
export function pendingNamesOf(error: unknown): string[] {
  if (!(error instanceof Error) || error.message !== "position_detail_pending")
    return [];
  const names = (error as { pendingNames?: unknown }).pendingNames;
  return Array.isArray(names)
    ? names.filter((name): name is string => typeof name === "string")
    : [];
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

export const MATCH_ALREADY_OPEN = "Já existe uma partida em andamento.";
export const MATCH_NO_OPEN = "Não há partida em andamento.";
export const MATCH_NOT_ENOUGH_TEAMS =
  "Faltam times na fila para iniciar a partida.";
export const MATCH_LOCKED =
  "Essa partida já foi encerrada. Não dá para apagar o gol.";
export const MATCH_PENALTY_WINNER_REQUIRED =
  "Empate nos pênaltis: escolha o vencedor.";
export const MATCH_INVALID_GOALKEEPER =
  "Esse goleiro não pode entrar neste time agora.";
export const MATCH_INVALID_SCORER =
  "Esse jogador não pode ser o autor deste gol.";
export const MATCH_NOT_ON_FIELD =
  "Essa pessoa não está em campo nesta partida.";
export const MATCH_ALREADY_REINFORCED = "Essa saída já teve Reforço.";
export const MATCH_INVALID_DONOR = "Esse Time não pode ceder o Reforço.";
export const MATCH_NO_DONOR_TEAM = "Não há Time na fila para ceder.";

export const MATCH_TITLE = "Partida";
export const MATCH_VIEW = "Ver partida";
export const MATCH_LIVE = "Partida rolando";
export const MATCH_LOADING = "Carregando a partida";
export const MATCH_LOAD_FAILED_TITLE = "Não deu pra abrir a partida";
export const MATCH_PAUSE = "Pausar";
export const MATCH_RESUME = "Retomar";
export const MATCH_START = "Iniciar";
export const MATCH_FINISH = "Encerrar";
export const MATCH_DISCARD = "Descartar";
export const MATCH_SWAP_KEEPER = "Trocar goleiro";
export const MATCH_PAUSED = "pausado";
export const MATCH_OVERTIME = "acrésc.";
export const MATCH_DELETE_GOAL = "apagar";
export const MATCH_CORRECT = "Corrigir";
export const MATCH_OWN_GOAL = "Gol contra";
export const MATCH_NO_ASSIST = "Sem assistência";
export const MATCH_ASSIST_TITLE = "Assistência";
export const MATCH_GOALS_TITLE = "Gols desta partida";
export const MATCH_TEAMS_QUEUE = "Fila de times";
export const MATCH_FINISHED_TITLE = "Partidas encerradas";
export const MATCH_TAP_GOAL = "toque p/ gol";
export const MATCH_REMATCH = "Revanche";
export const MATCH_CONDUCTOR_OFFLINE = "O Condutor está sem conexão.";
export const MATCH_OFFLINE =
  "Sem conexão. Os botões ficam bloqueados até a rede voltar.";
export const MATCH_DISCARD_TITLE = "Descartar partida?";
export const MATCH_DISCARD_TEXT =
  "Gols somem, ninguém recebe crédito e a fila volta ao estado de antes do apito.";
export const MATCH_DISCARD_CONFIRM = "Descartar";
export const MATCH_DISCARD_BUSY = "Descartando";
export const MATCH_FINISH_TITLE = "Encerrar partida?";
export const MATCH_FINISH_CONFIRM = "Confirmar";
export const MATCH_FINISH_BUSY = "Encerrando";
export const MATCH_WINNER_PICK = "Quem venceu nos pênaltis?";
export const MATCH_KEEPER_FIRST = "Primeiro da fila";
export const MATCH_QUEUE_NEXT = "PRÓXIMO";
export const MATCH_QUEUE_EMPTY = "Ninguém esperando na fila";
export const MATCH_QUEUE_OPEN = "Ver fila";
export const MATCH_QUEUE_SHEET_TITLE = "Fila";
export const MATCH_MY_TEAM_NEXT = "Seu Time joga na próxima";
export const matchMyTeamPosition = (position: number) =>
  `Seu Time é o ${position}º na fila`;
const queueTeamLabel = (teamNumber: number, isComplete: boolean) =>
  isComplete
    ? sortTeamTitle(teamNumber)
    : `${sortTeamTitle(teamNumber)} (incompleto)`;
export const matchQueueStrip = (
  next: { teamNumber: number; isComplete: boolean },
  after: { teamNumber: number; isComplete: boolean } | null
) =>
  after
    ? `Próxima: ${queueTeamLabel(next.teamNumber, next.isComplete)} · depois ${queueTeamLabel(after.teamNumber, after.isComplete)}`
    : `Próxima: ${queueTeamLabel(next.teamNumber, next.isComplete)}`;

export const MATCH_LEAVE_REINFORCE = "Chamar Reforço";
export const MATCH_LEAVE_ONLY = "Só marcar saída";
export const MATCH_ROSTER_TEXT =
  "Toque em Marcar saída quando alguém parar de jogar.";
export const MATCH_ROSTER = "Elenco";
export const MATCH_EVENTS_TITLE = "Últimos lances";
export const MATCH_REINFORCE_TITLE = "Quem cede o Reforço?";
export const MATCH_REINFORCE_DRAW_TEAM = "Sortear o Time";
export const MATCH_REINFORCE_DRAW_TEAM_TEXT =
  "O app escolhe entre os Times da fila.";
export const MATCH_REINFORCE_DRAW_TEAM_RESULT =
  "O Time sorteado fica com um jogador a menos.";
export const MATCH_REINFORCE_DRAW = "Sortear jogador";
export const MATCH_REINFORCE_BACK = "Voltar à partida";
export const MATCH_EVENT_REINFORCEMENT = "Reforço";
export const MATCH_EVENT_LEAVE = "Saída";
export const MATCH_EVENT_INCLUSION = "Inclusão";
export const MATCH_EVENT_RETURN = "Volta";
export const MATCH_LEFT_BY_SELF = "Registrou a própria saída.";
export const MATCH_GOL_DETAIL = "GOL";
export const ARRIVAL_FIELD_DRAW =
  "Entra agora num dos Times em campo (sorteio)";

export const matchRosterTitle = (team: string) => `${team} em campo`;
export const matchRosterLabel = (team: number, n: number, cap: number) =>
  `Elenco do Time ${team}, ${n} de ${cap}${n < cap ? ", incompleto" : ""}`;
export const matchLeaveOnField = (team: string) => `${team} · em campo`;
export const matchLinePlayers = (n: number, cap: number) =>
  `Na linha · ${n} de ${cap} + goleiro`;

export const MATCH_CARD = "Cartão";
export const MATCH_CARD_YELLOW = "Amarelo";
export const MATCH_CARD_RED = "Vermelho";
export const MATCH_CARD_NO_REINFORCE =
  "Nenhum cartão chama Reforço: o Time joga com menos de propósito.";
export const MATCH_CARD_MARK_NO_REINFORCE = "Nenhum cartão chama Reforço.";
export const MATCH_CARD_KEEPER_NOTE =
  "Nenhum cartão chama Reforço. O app não pede quem vai para o gol, e gols sofridos nesse tempo não contam para goleiro nenhum.";
export const MATCH_CARD_MARK_KEEPER_NOTE =
  "Nenhum cartão chama Reforço. Os gols sofridos continuam contando para o goleiro.";
export const MATCH_CARD_REGISTER_YELLOW = "Registrar amarelo";
export const MATCH_CARD_REGISTER_RED = "Registrar vermelho";
export const MATCH_CARD_REGISTER_SECOND = "Registrar segundo amarelo";
export const MATCH_CARD_SECOND_TITLE = "Amarelo · segundo, vira vermelho";
export const MATCH_CARD_RED_TEXT =
  "Fora do resto da Partida. Volta a jogar na próxima.";
export const MATCH_CARD_MARK_DETAIL = "Continua em campo, marcado de amarelo";
export const MATCH_CARD_MARK_KEEPER_DETAIL =
  "Goleiro · continua no gol, marcado de amarelo";
export const MATCH_CARD_MARK_ROW = "Amarelo";
export const minutesOut = (n: number) =>
  `${n} ${n === 1 ? "minuto" : "minutos"} fora`;
export const MATCH_CARD_EXPELLED_ROW = "Expulso · volta na próxima Partida";
export const matchCardTitle = (name: string) => `Cartão para ${name}`;
export const matchCardFor = (name: string) => `Cartão para ${name}`;
export const matchCardTarget = (team: number, isKeeper: boolean) =>
  `Time ${team} · ${isKeeper ? "goleiro" : "em campo"}`;
export const matchCardYellowText = (
  outMin: number,
  team: number,
  n: number,
  until: string
) => `${minutesOut(outMin)}. O Time ${team} joga com ${n} até ${until}.`;
export const MATCH_CARD_MARK_TEXT =
  "Continua em campo, marcado de amarelo. O segundo amarelo nesta Partida vira vermelho.";
export const MATCH_CARD_MARK_KEEPER_TEXT =
  "Continua no gol, marcado de amarelo. O segundo amarelo nesta Partida vira vermelho.";
export const matchCardRedOutfieldText = (team: number, n: number) =>
  `Fora do resto da Partida. O Time ${team} joga com ${n} até o fim. Volta a jogar na próxima.`;
export const matchCardKeeperYellowText = (
  outMin: number,
  team: number,
  n: number,
  until: string
) =>
  `${minutesOut(outMin)}. Alguém da linha cobre o gol e o Time ${team} fica com ${n} na linha até ${until}.`;
export const matchCardKeeperRedText = (team: number, n: number) =>
  `Fora do resto da Partida. Alguém da linha cobre o gol; o Time ${team} fica com ${n} na linha até o fim.`;
export const matchCardHasYellow = (name: string, at: string) =>
  `${name} já tem um amarelo nesta Partida (${at}).`;
export const matchCardSecondText = (name: string, team: number, n: number) =>
  `${name} fica fora do resto da Partida. O Time ${team} joga com ${n} até o fim.`;
export const matchCardYellowRow = (
  remaining: string | null,
  isKeeper: boolean
) =>
  `${isKeeper ? "GOL · " : ""}Amarelo${remaining ? ` · volta em ${remaining}` : ""}`;
export const matchCardBack = (name: string, isKeeper: boolean) =>
  `${name} pode voltar${isKeeper ? " ao gol" : ""}`;
export const matchCardPillA11y = (
  name: string,
  team: number,
  remaining: string,
  paused: boolean
) =>
  `${name}, Time ${team}, amarelo, volta em ${remaining}${paused ? ", parado" : ""}`;
export const matchCardEventSecond =
  "Segundo amarelo · fora do resto da Partida";
export const matchCardEventDirect = "Direto · fora do resto da Partida";
export const matchCardEventKeeper = (outMin: number) =>
  `Goleiro · ${minutesOut(outMin)}, a linha cobre o gol`;
export const matchRosterOnField = (line: number, keeperIn: boolean) =>
  `Em campo agora · ${line} na linha${keeperIn ? " + goleiro" : ", a linha cobre o gol"}`;
export const matchReinforceOptionText = (team: number, cap: number) =>
  `Um jogador de um Time da fila entra no lugar. O Time ${team} segue com ${cap}.`;
export const matchLeaveOnlyText = (team: number, n: number, cap: number) =>
  `O Time ${team} joga com ${n} de ${cap}. Quem chegar depois entra nele.`;
export const matchTeamPlaysWith = (team: number, n: number, cap: number) =>
  `O Time ${team} joga com ${n} de ${cap}.`;
export const matchReinforceSubtitle = (team: number, name: string) =>
  `Entra no Time ${team}, no lugar de ${name}. O app sorteia a pessoa dentro do Time escolhido.`;
export const matchQueueOption = (
  pos: number,
  n: number,
  cap: number,
  incomplete: boolean
) =>
  `${pos}º na fila · ${n} de ${cap}${incomplete ? ` · ${SORT_INCOMPLETE}` : ""}`;
export const matchTeamLeftWith = (team: number, n: number, cap: number) =>
  `O Time ${team} fica com ${n} de ${cap}.`;
export const matchTeamLeavesQueue = (team: number) =>
  `O Time ${team} sai da fila.`;
export const matchReinforceResult = (name: string, from: number, to: number) =>
  `${name} (Time ${from}) entra no Time ${to}.`;
export const matchNoDonor = (team: number, n: number, cap: number) =>
  `Não há Time na fila para ceder. O Time ${team} segue com ${n} de ${cap}.`;
export const matchSelfLeftTitle = (name: string, team: number) =>
  `${name} saiu do Time ${team}`;
export const matchTeamNowWith = (team: number, n: number, cap: number) =>
  `O Time ${team} está com ${n} de ${cap}.`;
export const arrivalField = (team: number) =>
  `Entra agora no Time ${team} (em campo)`;
export const arrivalQueue = (team: number) =>
  `Vai para o Time ${team}, na fila`;
export const arrivalNewTeam = (team: number) =>
  `Vai para o Time ${team}, um Time novo no fim da fila`;
export const matchEventReinforceText = (name: string, team: number) =>
  `${name} entra no Time ${team}`;
export const matchEventReinforceDetail = (from: number, left: string) =>
  `Veio do Time ${from}, no lugar de ${left}.`;
export const matchEventLeaveText = (name: string, team: number) =>
  `${name} · Time ${team}`;
export const matchEventEnterText = (name: string, team: number) =>
  `${name} entra no Time ${team}`;
export const matchOccupancy = (n: number, cap: number) => `${n}/${cap}`;

export function matchArrivalText(
  kind: "field" | "field_draw" | "queue" | "new_team",
  teamNumber: number | null
): string {
  switch (kind) {
    case "field":
      return arrivalField(teamNumber ?? 0);
    case "field_draw":
      return ARRIVAL_FIELD_DRAW;
    case "queue":
      return arrivalQueue(teamNumber ?? 0);
    case "new_team":
      return arrivalNewTeam(teamNumber ?? 0);
  }
}

export const matchScoreLine = (home: number, away: number) =>
  `${home} × ${away}`;
export const matchDurationLine = (clock: string) => `Duração ${clock}`;
export const matchKeeperLine = (name: string) => `Goleiro · ${name}`;
export const matchSwapKeeperOf = (team: string) => `Trocar goleiro · ${team}`;
export const matchGoalScorerTitle = (team: string) => `Autor do gol — ${team}`;
export const matchAssistHint = (name: string) => `Gol de ${name} — opcional`;
export const matchVsLine = (home: number, away: number) =>
  `Time ${home} × Time ${away}`;
export const matchNumberLabel = (number: number) => `Partida ${number}`;

/** Consequência do preview: o banco manda o código, a tela fala em português. */
export function matchFinishConsequence(
  consequence: string,
  fallback: string | null,
  nextIsRematch: boolean
): string {
  const fallbackText =
    fallback === "REMATCH_TIED_AGAIN"
      ? "A revanche empatou de novo: os dois Times saem."
      : fallback === "NO_CHALLENGER"
        ? "Sem desafiante: os dois Times saem."
        : null;
  const main =
    fallbackText ??
    (consequence === "WINNER_STAYS"
      ? "O vencedor fica. O perdedor vai para o fim da fila."
      : consequence === "ROTATION"
        ? "Os dois Times saem. O próximo da fila entra."
        : consequence === "MAX_WINS_OUT"
          ? "O vencedor atingiu o máximo de vitórias e sai com o perdedor."
          : consequence === "REMATCH"
            ? "Empate: revanche. Os dois Times ficam."
            : consequence === "CHALLENGER_STAYS"
              ? "Empate: o desafiante fica. O outro Time sai."
              : consequence === "BOTH_OUT"
                ? "Empate: os dois Times saem."
                : consequence);
  return nextIsRematch && consequence !== "REMATCH"
    ? `${main} Próxima é a revanche.`
    : main;
}

/** Código de erro das RPCs da Partida → pt-BR; desconhecido cai em ACTION_FAILED. */
export function matchErrorMessage(code: string): string {
  switch (code) {
    case "match_open":
      return MATCH_ALREADY_OPEN;
    case "no_open_match":
      return MATCH_NO_OPEN;
    case "not_enough_teams":
      return MATCH_NOT_ENOUGH_TEAMS;
    case "match_locked":
      return MATCH_LOCKED;
    case "penalty_winner_required":
      return MATCH_PENALTY_WINNER_REQUIRED;
    case "invalid_goalkeeper":
      return MATCH_INVALID_GOALKEEPER;
    case "invalid_scorer":
      return MATCH_INVALID_SCORER;
    case "not_on_field":
      return MATCH_NOT_ON_FIELD;
    case "already_reinforced":
      return MATCH_ALREADY_REINFORCED;
    case "invalid_donor":
      return MATCH_INVALID_DONOR;
    case "no_donor":
      return MATCH_NO_DONOR_TEAM;
    case "not_conductor":
      return SORT_NOT_CONDUCTOR;
    case "not_member":
      return SORT_NOT_MEMBER;
    case "event_not_active":
      return SORT_EVENT_NOT_ACTIVE;
    default:
      return ACTION_FAILED;
  }
}

/** Erro de uma ação da Partida → texto; sem rede, o convite a tentar de novo. */
export function matchFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return code === "network_error"
    ? SORT_LOAD_FAILED_TEXT
    : matchErrorMessage(code);
}

/** Erro de uma ação do Sorteio → texto; sem rede, o convite a tentar de novo. */
export function sortFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "position_detail_pending") {
    return positionDetailPendingMessage(pendingNamesOf(error));
  }
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

// --- Bolinhas ---
export const BOLINHAS = "Bolinhas";
export const BOLINHAS_UNAVAILABLE =
  "Bolinhas: nenhum Time fora de campo precisa de jogador.";
export const BOLINHAS_NO_GIVER_UNAVAILABLE =
  "Bolinhas: nenhum Time pode ceder agora.";
export const BOLINHAS_UNAVAILABLE_A11Y =
  "Bolinhas, indisponível: nenhum Time fora de campo precisa de jogador";
export const BOLINHAS_HELP =
  "Escolha quem cede e depois quem recebe. Azul vai para quem recebe; vermelha fica onde está. Goleiro não entra no saco.";
export const BOLINHAS_RECEIVER = "Quem recebe";
export const BOLINHAS_GIVER = "Quem cede";
export const BOLINHAS_PICK_GIVER_FIRST =
  "Escolha antes quem cede. Cada Time mostra quantas azuis e vermelhas vão para o saco.";
export const BOLINHAS_CHANGE = "Trocar";
export const BOLINHAS_FULL = "Completo: sem vaga para receber.";
export const BOLINHAS_ON_FIELD = "Em campo: não cede nem recebe.";
export const BOLINHAS_IS_GIVER = "Vai ceder.";
export const BOLINHAS_NO_OTHER_RECEIVER = "Nenhum outro Time pode receber.";
export const BOLINHAS_DRAW = "Sortear";
export const BOLINHAS_MOVE = "Mover jogadores";
export const BOLINHAS_INTO_BAG = "vão para o saco";
export const BOLINHAS_SHAKING = "Sacudindo o saco…";
export const BOLINHAS_CLOSE = "Fechar";
export const BOLINHAS_NO_RECEIVER_TITLE = "Nenhum Time pode receber";
export const BOLINHAS_NO_RECEIVER_TEXT =
  "Todos os Times fora de campo estão completos. As Bolinhas servem para completar um Time incompleto.";
export const BOLINHAS_NO_GIVER_TITLE = "Nenhum Time pode ceder";
export const BOLINHAS_NO_GIVER_TEXT = "Os Times com jogadores estão em campo.";
export const BOLINHAS_BACK_TO_TEAMS = "Voltar aos Times";
export const BOLINHAS_FAILED_TITLE = "Não deu pra sortear";
export const BOLINHAS_FAILED_TEXT =
  "Sem conexão. Nada mudou nos Times. Confira a internet e tente de novo.";
export const BOLINHAS_RETRY = "Tentar de novo";
export const BOLINHAS_CHANGED_TITLE = "A situação mudou";
export const BOLINHAS_CHANGED_TEXT =
  "Os Times foram atualizados. Escolha de novo quem cede e quem recebe.";
export const BOLINHAS_NOT_CONDUCTOR_NO_NAME =
  "Outra pessoa assumiu a condução. Nada mudou nos Times.";
export const BOLINHAS_NOT_CONDUCTOR_TITLE = "Você não conduz mais este Evento";
export const BOLINHAS_REMINDER_TEXT =
  "O próximo confronto tem Time incompleto. Dá para completar antes de iniciar.";
export const BOLINHAS_REMINDER_ACTION = "Ajustar com Bolinhas";
export const MATCH_NEXT_MATCH = "PRÓXIMO CONFRONTO";
export const MATCH_ON_FIELD = "EM CAMPO";
export const bolinhasReminderTitle = (team: number, n: number, cap: number) =>
  `Time ${team} está com ${n}/${cap}`;
export const bolinhasReminderTitleMany = (teams: number[]) =>
  `${teams.map((team) => `Time ${team}`).join(" e ")} estão incompletos`;
export const bolinhasSpots = (n: number) => (n === 1 ? "1 vaga" : `${n} vagas`);
export const bolinhasInBag = (n: number) =>
  n === 1 ? "1 bolinha no saco" : `${n} bolinhas no saco`;
export const bolinhasGives = (n: number) => `Cede · ${bolinhasInBag(n)}`;
export const bolinhasBalls = (blue: number, red: number) =>
  `${blue} ${blue === 1 ? "azul" : "azuis"} · ${red} ${red === 1 ? "vermelha" : "vermelhas"}`;
export const bolinhasAllMoveRow = (team: number) =>
  `Todos vão, sem sorteio · o Time ${team} sai da fila`;
export const bolinhasSummary = (
  giver: number,
  receiver: number,
  blue: number,
  red: number
) =>
  `O Time ${giver} cede para o Time ${receiver} · ${blue} ${blue === 1 ? "azul" : "azuis"}, ${red} ${red === 1 ? "vermelha" : "vermelhas"}`;
export const bolinhasAfter = (
  receiver: number,
  giver: number,
  giverLeft: number,
  cap: number
) =>
  `Depois: o Time ${receiver} fica com ${cap} de ${cap} e o Time ${giver} fica com ${giverLeft} de ${cap}.`;
export const bolinhasAllMoveTitle = (
  n: number,
  giver: number,
  receiver: number
) =>
  `Os ${n} do Time ${giver} vão para o Time ${receiver}. O Time ${giver} sai da fila.`;
export const bolinhasAllMoveText = (
  giver: number,
  receiver: number,
  total: number,
  cap: number
) =>
  `Sem sorteio: o Time ${giver} tem menos jogadores que as vagas. O Time ${receiver} fica com ${total} de ${cap}.`;
export const bolinhasMovedRow = (name: string, receiver: number) =>
  `${name} → Time ${receiver}`;
export const bolinhasMovedToast = (
  names: string,
  receiver: number,
  plural: boolean
) => `${names} ${plural ? "foram" : "foi"} para o Time ${receiver}.`;
export const bolinhasGiverToReceiver = (giver: number, receiver: number) =>
  `O Time ${giver} cede para o Time ${receiver}`;
export const bolinhasStays = (team: number) => `Fica no Time ${team}`;
export const bolinhasGoes = (team: number) => `Vai para o Time ${team}`;
export const bolinhasProgress = (i: number, n: number) =>
  `Bolinha ${i} de ${n}`;
export const bolinhasResultTitle = (
  names: string,
  team: number,
  plural: boolean
) => `${names} ${plural ? "vão" : "vai"} para o Time ${team}`;
export const bolinhasRevealA11y = (name: string, blue: boolean, team: number) =>
  `${name}, ${blue ? "azul, vai para o Time" : "vermelha, fica no Time"} ${team}`;
export const bolinhasNoteTitle = (
  names: string,
  team: number,
  plural: boolean
) => `Bolinhas: ${names} ${plural ? "foram" : "foi"} para o Time ${team}`;
export const bolinhasNoteAllMoveTitle = (n: number, team: number) =>
  `Bolinhas: os ${n} foram para o Time ${team}`;
export const bolinhasNoteCaption = (giver: number, ago: string) =>
  `O Time ${giver} cedeu · ${ago}`;
export const bolinhasAgo = (minutes: number) =>
  minutes < 1 ? "agora" : `há ${minutes} min`;
export const bolinhasCameFrom = (team: number) =>
  `Bolinhas · veio do Time ${team}`;
export const bolinhasNotConductorText = (name: string) =>
  `${name} assumiu a condução. Nada mudou nos Times.`;
export const bolinhasLegend = (n: number, blue: boolean) =>
  blue
    ? `${n} ${n === 1 ? "AZUL" : "AZUIS"}`
    : `${n} ${n === 1 ? "VERMELHA" : "VERMELHAS"}`;
export const bolinhasColumnCount = (n: number, total: number) =>
  `${n}/${total}`;
