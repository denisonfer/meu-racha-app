import { storage } from "@/lib/storage";
import { lastOwnerId } from "../hooks/use-session";

const KEY = "pending-destination";

// guardar uma tela de entrar mandaria a pessoa de volta pro login depois de entrar
const AUTH_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];

// quem toca "Sair" escolheu sair: a tela de onde saiu não é para onde voltar
let isSigningOut = false;

export const setSigningOut = (value: boolean) => {
  isSigningOut = value;
};

// a folha de baixo abriria sem o cache e sem contexto: salva a tela de baixo
export function sheetParentPath(path: string) {
  const [pathname = ""] = path.split("?");
  const parent = pathname
    .replace(/^(\/racha\/[^/]+)\/(?:delete|leave)$/, "$1")
    .replace(/^(\/racha\/[^/]+\/member\/[^/]+)\/(?:expel|transfer)$/, "$1")
    .replace(/^(\/racha\/[^/]+)\/approve\/[^/]+$/, "$1/requests");
  return parent === pathname ? path : parent;
}

export async function savePendingDestination(path: string) {
  if (isSigningOut) {
    isSigningOut = false;
    return;
  }
  const [pathname = ""] = path.split("?");
  if (AUTH_PATHS.includes(pathname)) return;
  // o dono evita que outra conta, entrando no aparelho, caia na tela da anterior
  await storage.setItem(
    KEY,
    JSON.stringify({ path: sheetParentPath(path), ownerId: lastOwnerId() })
  );
}

export async function takePendingDestination(
  userId: string
): Promise<string | null> {
  try {
    const saved = await storage.getItem(KEY);
    await storage.removeItem(KEY);
    if (!saved) return null;
    const { path, ownerId } = JSON.parse(saved);
    if (typeof path !== "string") return null;
    return ownerId === null || ownerId === userId ? path : null;
  } catch {
    return null;
  }
}

export async function clearPendingDestination() {
  await storage.removeItem(KEY);
}
