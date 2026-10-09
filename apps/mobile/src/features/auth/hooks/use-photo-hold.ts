import { useSyncExternalStore } from "react";

// O Cadastro cria a sessão antes de enviar a foto. Enquanto a foto não está
// salva, o guard do (auth) segura a entrada no app.
let isHeld = false;
const listeners = new Set<() => void>();

export function setPhotoHold(value: boolean) {
  isHeld = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const usePhotoHold = () => useSyncExternalStore(subscribe, () => isHeld);
