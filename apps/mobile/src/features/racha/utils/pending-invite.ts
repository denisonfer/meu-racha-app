let pendingCode: string | null = null;

export const savePendingInvite = (code: string) => {
  pendingCode = code;
};

export const getPendingInvite = () => pendingCode;

export const clearPendingInvite = () => {
  pendingCode = null;
};
