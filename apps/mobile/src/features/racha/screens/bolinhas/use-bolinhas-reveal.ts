import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, BackHandler, Vibration } from "react-native";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  BOLINHAS,
  BOLINHAS_SHAKING,
  bolinhasProgress,
  bolinhasResultTitle,
  bolinhasRevealA11y,
} from "../../utils/racha-messages";
import { joinNames } from "../../utils/sort-view";
import {
  useBolinhasRevealData,
  useEventBolinhas,
} from "../../hooks/use-event-bolinhas";
import { buildTimeline, startOf } from "./bolinhas-reveal-timeline";

export function useBolinhasReveal() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const pending = useBolinhasRevealData(id, eventId);
  const { applyDrawn } = useEventBolinhas(id, eventId);
  const isReduced = useReducedMotion();
  const order = useMemo(
    () =>
      (pending?.drawn.order ?? []).map((pick) => ({
        personId: pick.personId,
        name: pick.displayName,
        color: pick.color,
      })),
    [pending]
  );
  const count = order.length;
  const timeline = useMemo(
    () => buildTimeline(Math.max(1, count), isReduced),
    [count, isReduced]
  );
  // relógio linear: cada bolinha, o saco e a boca derivam a pose dele na thread de UI
  const clock = useSharedValue(0);
  const [progress, setProgress] = useState(
    isReduced ? bolinhasProgress(1, count) : BOLINHAS_SHAKING
  );
  const [arrived, setArrived] = useState({ blue: 0, red: 0 });
  const [isDone, setIsDone] = useState(false);

  const blues = order.filter((pick) => pick.color === "blue");
  const resultTitle = pending
    ? bolinhasResultTitle(
        joinNames(blues.map((pick) => pick.name)),
        pending.receiverTeamNumber,
        blues.length > 1
      )
    : BOLINHAS;

  useEffect(() => {
    if (!pending || count === 0) return;
    // os Times novos entram no cache sem aparecer: a tela de baixo é a de Times
    applyDrawn(pending.drawn);
    clock.value = withTiming(timeline.totalMs, {
      duration: timeline.totalMs,
      easing: Easing.linear,
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) =>
      void timers.push(setTimeout(run, ms));

    if (!timeline.isReduced) {
      at(800, () => setProgress(bolinhasProgress(1, count)));
    }
    order.forEach((pick, index) => {
      const start = startOf(timeline, index);
      const isBlue = pick.color === "blue";
      at(start, () => setProgress(bolinhasProgress(index + 1, count)));
      at(start + timeline.revealAtMs, () => {
        // O produto decide entre Vibration e expo-haptics (impacto leve): o pacote não está instalado.
        if (isBlue) Vibration.vibrate(30);
        AccessibilityInfo.announceForAccessibility(
          bolinhasRevealA11y(
            pick.name,
            isBlue,
            isBlue ? pending.receiverTeamNumber : pending.giverTeamNumber
          )
        );
      });
      at(start + timeline.travelAtMs, () =>
        setArrived((current) => ({
          ...current,
          [pick.color]: current[pick.color] + 1,
        }))
      );
    });
    at(timeline.resultMs, () => {
      setIsDone(true);
      AccessibilityInfo.announceForAccessibility(resultTitle);
    });
    return () => timers.forEach(clearTimeout);
    // a revelação roda uma vez por sorteio; o resultado só muda com ele
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // sem voltar no meio da animação: o resultado só fecha pelo Fechar
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => !isDone
    );
    return () => subscription.remove();
  }, [isDone]);

  const close = () => router.back();

  return {
    pending,
    order,
    clock,
    timeline,
    progress,
    arrived,
    isDone,
    title: isDone ? resultTitle : BOLINHAS,
    blueCount: blues.length,
    redCount: count - blues.length,
    close,
    goBack: () => router.back(),
  };
}
