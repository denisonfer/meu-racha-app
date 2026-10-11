export type TPushBanner = "unasked" | "denied" | null;

type TPermission = { granted: boolean; canAskAgain: boolean };

// A chave é a escolha da conta; o aviso só explica por que o push não chega
// neste aparelho. canAskAgain, e não só o status: no Android 13+ um primeiro
// "Não permitir" ainda deixa perguntar.
export function pushBanner(
  pushEnabled: boolean | undefined,
  permission: TPermission | null
): TPushBanner {
  if (pushEnabled !== true || !permission || permission.granted) return null;
  return permission.canAskAgain ? "unasked" : "denied";
}
