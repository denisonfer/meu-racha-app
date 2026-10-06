import { StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { BolinhaMark, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import type { TBolinhasColor as TBallColor } from "@meu-racha/domain";
import {
  APEX_Y,
  clamp01,
  COLUMN_BALL,
  EASE_ENTER,
  EASE_EXIT,
  EASE_POP,
  EASE_STANDARD,
  lerp,
  MOUTH_Y,
  SLOT_SIZE,
  SLOT_Y,
  type TTimeline,
} from "./bolinhas-reveal-timeline";

export type TBallGeometry = {
  mouthX: number;
  apexX: number;
  slotX: number;
  // 56 quando cabe; encolhe com muitas bolinhas na fileira
  slotSize: number;
  colX: number;
  colY: number;
};

type TProps = {
  clock: SharedValue<number>;
  timeline: TTimeline;
  startMs: number;
  name: string;
  color: TBallColor;
  geometry: TBallGeometry;
  labelColor: string;
  // "AZUL · vai" ou "VERMELHA · fica"
  colorText: string;
};

const BALL = SLOT_SIZE;
const LABEL_WIDTH = 160;

/** Uma bolinha: sai da boca fechada, cai na fileira, segura, revela e vai para a coluna. */
export const BolinhasRevealBall = ({
  clock,
  timeline,
  startMs,
  name,
  color,
  geometry: g,
  labelColor,
  colorText,
}: TProps) => {
  const reveal = timeline.revealAtMs;
  const travel = timeline.travelAtMs;

  const container = useAnimatedStyle(() => {
    const u = clock.value - startMs;
    let x = g.mouthX;
    let y = MOUTH_Y;
    let size = 36;
    let opacity = 0;
    let squash = 0;
    let pop = 1;
    if (timeline.isReduced) {
      // sem arco: a bolinha aparece no lugar, desfaz o fade e depois troca para a coluna
      x = g.slotX;
      y = SLOT_Y;
      size = g.slotSize;
      opacity = clamp01(u / 200);
    } else if (u >= 0 && u < 300) {
      const p = u / 300;
      x = lerp(g.mouthX, g.apexX, p);
      y = lerp(MOUTH_Y, APEX_Y, EASE_ENTER.factory()(p));
      size = lerp(36, 50, p);
      opacity = clamp01(u / 120);
    } else if (u >= 300) {
      const p = clamp01((u - 300) / 260);
      x = lerp(g.apexX, g.slotX, p);
      y = lerp(APEX_Y, SLOT_Y, EASE_EXIT.factory()(p));
      size = lerp(50, g.slotSize, p);
      opacity = 1;
      // 4% de achatamento ao pousar, no lugar da mola
      squash = Math.sin(clamp01((u - 560) / 140) * Math.PI) * 0.04;
    }
    if (u >= reveal && !timeline.isReduced) {
      const p = clamp01((u - reveal) / 640);
      // 0,85 → 1,08 → 1: sobe pelo easing-pop e assenta
      pop =
        p < 0.55
          ? lerp(0.85, 1.08, EASE_POP.factory()(p / 0.55))
          : lerp(1.08, 1, (p - 0.55) / 0.45);
    }
    if (u >= travel) {
      const p = timeline.isReduced ? 1 : clamp01((u - travel) / 360);
      const e = EASE_STANDARD.factory()(p);
      x = lerp(timeline.isReduced ? g.slotX : g.slotX, g.colX, e);
      y = lerp(SLOT_Y, g.colY, e);
      size = lerp(g.slotSize, COLUMN_BALL, e);
      pop = 1;
      squash = 0;
    }
    const scale = (size / BALL) * pop;
    return {
      opacity,
      transform: [
        { translateX: x - BALL / 2 },
        { translateY: y - BALL / 2 },
        { scaleX: scale * (1 + squash) },
        { scaleY: scale * (1 - squash) },
      ],
    };
  });

  const revealProgress = (u: number) => {
    "worklet";
    return clamp01((u - reveal) / (timeline.isReduced ? 200 : 160));
  };

  const face = useAnimatedStyle(() => {
    const p = revealProgress(clock.value - startMs);
    const fill =
      color === "blue"
        ? theme.colors.bolinhaAzul
        : theme.colors.bolinhaVermelha;
    return {
      backgroundColor: interpolateColor(
        p,
        [0, 1],
        [theme.colors.surfaceRaised, fill]
      ),
      borderColor: interpolateColor(
        p,
        [0, 1],
        ["rgba(198, 242, 78, 0.12)", fill]
      ),
    };
  });
  const question = useAnimatedStyle(() => ({
    opacity: 1 - revealProgress(clock.value - startMs),
  }));
  const mark = useAnimatedStyle(() => ({
    opacity: revealProgress(clock.value - startMs),
  }));

  // anel lima pulsando enquanto a bolinha segura fechada
  const ring = useAnimatedStyle(() => {
    const u = clock.value - startMs;
    const isHolding = u >= 700 && u < reveal;
    const f = 0.5 - 0.5 * Math.cos(((u - 700) / 900) * 2 * Math.PI);
    const spread = 3 + 5 * f;
    return {
      opacity: isHolding ? 0.25 - 0.13 * f : 0,
      transform: [{ scale: (g.slotSize + 2 * spread) / (g.slotSize + 16) }],
    };
  });

  const below = useAnimatedStyle(() => {
    const u = clock.value - startMs;
    return {
      opacity: clamp01((u - reveal) / 120) * (1 - clamp01((u - travel) / 120)),
    };
  });
  const side = useAnimatedStyle(() => ({
    opacity: clamp01(
      (clock.value - startMs - travel) / (timeline.isReduced ? 1 : 360)
    ),
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: g.slotX - (g.slotSize + 16) / 2,
            top: SLOT_Y - (g.slotSize + 16) / 2,
            width: g.slotSize + 16,
            height: g.slotSize + 16,
            borderRadius: (g.slotSize + 16) / 2,
          },
          ring,
        ]}
      />
      <Animated.View style={[styles.ball, container]}>
        <Animated.View style={[styles.face, face]}>
          <Animated.View style={[styles.center, question]}>
            <Text style={styles.question}>?</Text>
          </Animated.View>
          <Animated.View style={[styles.center, mark]}>
            <BolinhaMark isBlue={color === "blue"} size={BALL / 2} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.below,
          { left: g.slotX - LABEL_WIDTH / 2, top: SLOT_Y + g.slotSize / 2 + 6 },
          below,
        ]}
      >
        <Text style={[styles.colorText, { color: labelColor }]}>
          {colorText}
        </Text>
        <Text preset="small" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.side,
          { left: g.colX + COLUMN_BALL / 2 + 10, top: g.colY - 10 },
          side,
        ]}
      >
        <Text numberOfLines={1} style={styles.sideName}>
          {name}
        </Text>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  ball: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BALL,
    height: BALL,
    zIndex: 5,
  },
  face: {
    flex: 1,
    borderRadius: BALL / 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  question: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: BALL * 0.5,
    lineHeight: BALL * 0.5 + 2,
  },
  ring: { position: "absolute", backgroundColor: theme.colors.action },
  below: {
    position: "absolute",
    width: LABEL_WIDTH,
    alignItems: "center",
    zIndex: 5,
  },
  colorText: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  name: { fontFamily: "Manrope-Bold", textAlign: "center" },
  side: { position: "absolute", zIndex: 5 },
  sideName: { fontFamily: "Manrope-Bold", fontSize: 15, lineHeight: 20 },
});
