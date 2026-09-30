// O link aberto sem sessão passa pelo login; o código espera aqui até o
// Convite abrir. ponytail: em memória — app fechado no meio do Cadastro perde
// o código (o plano B é o código escrito na página web); AsyncStorage, já
// instalado, se isso incomodar.
let pendingCode: string | null = null;

export const savePendingInvite = (code: string) => {
  pendingCode = code;
};

// só lê: pode ser chamado na renderização
export const getPendingInvite = () => pendingCode;

// apaga: chame num useEffect, quando o Convite já abriu
export const clearPendingInvite = () => {
  pendingCode = null;
};
