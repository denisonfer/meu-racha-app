import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { TEventMatch } from "@meu-racha/domain";
import { rachaApi, type TEventMatchLive } from "../racha-api";
import { eventMatchKey } from "./use-event-match";
import { eventSortKey } from "./use-event-sort";

const CONDUCTOR_OFFLINE_MS = 90_000;

/**
 * Assina o canal privado via racha-api: invalida o retrato quando o seq sobe,
 * refaz no reconnect e marca o Condutor ausente depois de 90 s sem presença.
 * track() só no app do Condutor com a tela montada e AppState active —
 * o listener de AppState já existe em lib/supabase.ts / query-client.ts;
 * aqui ele só decide se publica presença.
 */
export function useEventMatchLive(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();
  const [isConductorOffline, setIsConductorOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let live: TEventMatchLive | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastPresentAt = Date.now();
    let appState: AppStateStatus = AppState.currentState;
    let wantTrack = false;

    const matchKey = eventMatchKey(rachaId, eventId);
    const sortKey = eventSortKey(rachaId, eventId);

    function portrait(): TEventMatch | undefined {
      return queryClient.getQueryData<TEventMatch>(matchKey);
    }

    function conductorPresent(): boolean {
      return live?.isConductorPresent() ?? false;
    }

    function tickOffline() {
      if (conductorPresent()) lastPresentAt = Date.now();
      const matchOpen = portrait()?.state === "open";
      setIsConductorOffline(
        Boolean(
          matchOpen &&
          !conductorPresent() &&
          Date.now() - lastPresentAt >= CONDUCTOR_OFFLINE_MS
        )
      );
    }

    async function syncTrack() {
      if (!live) return;
      const next =
        Boolean(portrait()?.viewer.canConduct) && appState === "active";
      if (next === wantTrack) return;
      wantTrack = next;
      if (next) await live.track();
      else await live.untrack();
    }

    const appSub = AppState.addEventListener("change", (state) => {
      appState = state;
      void syncTrack();
    });

    void rachaApi
      .subscribeEventMatch(eventId, {
        onMatchChanged: (seq) => {
          if (seq <= (portrait()?.seq ?? 0)) return;
          void queryClient.invalidateQueries({ queryKey: matchKey });
          // Reforço, Inclusão e Volta mudam o Time de alguém: a faixa da fila lê os Times
          void queryClient.invalidateQueries({ queryKey: sortKey });
        },
        onSubscribed: () => {
          // reconnect: o servidor pode ter avançado o seq enquanto estávamos fora
          void queryClient.invalidateQueries({ queryKey: matchKey });
          void syncTrack();
          tickOffline();
        },
        onPresenceSync: () => {
          tickOffline();
        },
      })
      .then((sub) => {
        if (cancelled) {
          sub.unsubscribe();
          return;
        }
        live = sub;
        timer = setInterval(() => {
          tickOffline();
          void syncTrack();
        }, 1000);
      });

    return () => {
      cancelled = true;
      appSub.remove();
      if (timer) clearInterval(timer);
      live?.unsubscribe();
    };
  }, [eventId, queryClient, rachaId]);

  return { isConductorOffline };
}
