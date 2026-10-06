import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { theme } from "@/ui/theme";
import {
  BAG_HEIGHT,
  BAG_TOP,
  BAG_WIDTH,
  clamp01,
  EASE_STANDARD,
  MOUTH_MS,
  SHAKE_MS,
  type TTimeline,
} from "./bolinhas-reveal-timeline";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const STROKE = "rgba(198, 242, 78, 0.35)";
// ±9°, ±6°, ±4° nos keyframes do handoff; o pivô é a base do saco
const SHAKE_AT = [0, 0.15, 0.35, 0.55, 0.75, 1];
const SHAKE_DEG = [0, -9, 8, -6, 4, 0];

type TProps = { clock: SharedValue<number>; timeline: TTimeline; left: number };

/** O saco: balança, abre a boca e fica aberto enquanto as bolinhas saem. */
export const BolinhasBag = ({ clock, timeline, left }: TProps) => {
  const style = useAnimatedStyle(() => {
    const progress = clamp01(clock.value / SHAKE_MS);
    return {
      transformOrigin: [BAG_WIDTH / 2, BAG_HEIGHT - 10, 0],
      transform: [
        {
          rotate: `${
            timeline.isReduced ? 0 : interpolate(progress, SHAKE_AT, SHAKE_DEG)
          }deg`,
        },
      ],
    };
  });

  const mouth = useAnimatedProps(() => {
    const open = timeline.isReduced
      ? 1
      : EASE_STANDARD.factory()(clamp01((clock.value - SHAKE_MS) / MOUTH_MS));
    return { rx: 20 + 12 * open, ry: 3 + 6 * open };
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bag, { left }, style]}
    >
      <Svg
        width={BAG_WIDTH}
        height={BAG_HEIGHT}
        viewBox="0 0 160 170"
        fill="none"
      >
        <Path
          d="M48 52 C22 78 18 128 36 150 C52 168 108 168 124 150 C142 128 138 78 112 52 Z"
          fill={theme.colors.surfaceRaised}
          stroke={STROKE}
          strokeWidth={2}
        />
        <Path
          d="M60 70 C54 100 56 130 66 152"
          stroke={theme.colors.surface}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M100 70 C106 100 104 130 94 152"
          stroke={theme.colors.surface}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M50 52 C62 44 98 44 110 52"
          stroke={theme.colors.action}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <AnimatedEllipse
          cx={80}
          cy={44}
          fill={theme.colors.background}
          stroke={STROKE}
          strokeWidth={2}
          animatedProps={mouth}
        />
        <Path
          d="M110 52 C122 56 128 64 126 76"
          stroke={theme.colors.action}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Circle cx={126} cy={79} r={3.5} fill={theme.colors.action} />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bag: {
    position: "absolute",
    top: BAG_TOP,
    width: BAG_WIDTH,
    height: BAG_HEIGHT,
  },
});
