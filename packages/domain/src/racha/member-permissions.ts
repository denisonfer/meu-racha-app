// espelha update_member e expel_member: o banco decide, isto só diz o que a UI mostra
export type TMemberRole = "OWNER" | "ADMIN" | "PLAYER";

// teto de Admins do Dono Free (regras 5.2); espelha a conta de update_member
export const ADMIN_LIMIT_FREE = 2;

export type TMemberPermissions = {
  canOpen: boolean;
  canEditStars: boolean;
  canChangeRole: boolean;
  canExpel: boolean;
  canTransferOwnership: boolean;
};

export function memberPermissions(
  viewerRole: TMemberRole,
  targetRole: TMemberRole,
  isSelf: boolean,
  isGoalkeeper: boolean
): TMemberPermissions {
  const isOwner = viewerRole === "OWNER";
  const isAdmin = viewerRole === "ADMIN";

  const canEditStars = !isGoalkeeper && (isOwner || (isAdmin && !isSelf));
  const canChangeRole = isOwner && !isSelf && targetRole !== "OWNER";
  const canExpel =
    !isSelf &&
    ((isOwner && targetRole !== "OWNER") ||
      (isAdmin && targetRole === "PLAYER"));
  const canTransferOwnership = isOwner && !isSelf;
  // sem nada editável a linha não abre (ex.: Admin diante de Admin Goleiro)
  const canOpen =
    (isOwner || (isAdmin && !isSelf)) &&
    (canEditStars || canChangeRole || canExpel || canTransferOwnership);

  return {
    canOpen,
    canEditStars,
    canChangeRole,
    canExpel,
    canTransferOwnership,
  };
}

export const canLeaveRacha = (role: TMemberRole) => role !== "OWNER";
