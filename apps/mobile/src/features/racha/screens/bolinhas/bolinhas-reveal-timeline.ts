import { Easing } from "react-native-reanimated";

// Tokens de motion do design system (tabela "Motion" do handoff)
export const EASE_ENTER = Easing.bezier(0, 0, 0.2, 1);
export const EASE_EXIT = Easing.bezier(0.4, 0, 1, 1);
export const EASE_STANDARD = Easing.bezier(0.2, 0, 0, 1);
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);

// Geometria em pontos, relativa ao topo do palco (a legenda em y = 0; no handoff, y - 103)
export const BAG_WIDTH = 160;
export const BAG_HEIGHT = 170;
export const BAG_TOP = 47;
export const MOUTH_Y = 93;
export const APEX_Y = 15;
export const DIVIDER_Y = 249;
export const SLOT_TOP = 269;
export const SLOT_SIZE = 56;
export const SLOT_Y = SLOT_TOP + SLOT_SIZE / 2;
export const COLUMN_TOP = 389;
export const COLUMN_HEIGHT = 240;
export const COLUMN_BALL_Y = 473;
export const COLUMN_STEP = 52;
export const COLUMN_BALL = 40;

export type TTimeline = {
  isReduced: boolean;
  firstMs: number;
  stepMs: number;
  // quando a bolinha termina de pousar e fica fechada
  holdMs: number;
  // revela depois de (700 + hold) do começo da bolinha
  revealAtMs: number;
  // chega à coluna
  travelAtMs: number;
  resultMs: number;
  totalMs: number;
};

export const SHAKE_MS = 800;
export const MOUTH_MS = 400;

/** Linha do tempo da tabela do handoff: 3 bolinhas dão 8 s e cada bolinha a mais soma o mesmo passo. */
export function buildTimeline(count: number, isReduced: boolean): TTimeline {
  if (isReduced) {
    // sem sacudir, arco nem mola: 1,2 s por bolinha
    const stepMs = 1200;
    const firstMs = 300;
    const lastEnd = firstMs + (count - 1) * stepMs + stepMs;
    return {
      isReduced,
      firstMs,
      stepMs,
      holdMs: 500,
      revealAtMs: 700,
      travelAtMs: stepMs,
      resultMs: lastEnd + 220,
      totalMs: lastEnd + 440,
    };
  }
  // o passo de cada bolinha é o validado com 3 (≈ 8 s): mais bolinhas alongam o total
  const holdMs = 450;
  const pauseMs = 150;
  const revealAtMs = 700 + holdMs;
  const travelAtMs = revealAtMs + 640 + pauseMs;
  const firstMs = SHAKE_MS + MOUTH_MS;
  const lastEnd = firstMs + (count - 1) * travelAtMs + travelAtMs + 360;
  return {
    isReduced,
    firstMs,
    stepMs: travelAtMs,
    holdMs,
    revealAtMs,
    travelAtMs,
    resultMs: lastEnd + 620,
    totalMs: lastEnd + 620 + 220,
  };
}

export const startOf = (tl: TTimeline, index: number) =>
  tl.firstMs + index * tl.stepMs;

export function clamp01(value: number) {
  "worklet";
  return Math.min(1, Math.max(0, value));
}

export function lerp(from: number, to: number, progress: number) {
  "worklet";
  return from + (to - from) * progress;
}
