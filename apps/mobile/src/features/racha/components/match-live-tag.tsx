import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MATCH_LIVE } from "../utils/racha-messages";

const PULSE_MIN_OPACITY = 0.35;
const PULSE_MS = 800;

// A opacidade pulsa para dar a ideia de "ao vivo"; com Reduzir Movimento ligado fica parada
export const MatchLiveTag = () => {
  const opacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, { duration: PULSE_MS }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.badge, pulse]}>
      <Text preset="caption" color="action" style={styles.label}>
        {MATCH_LIVE.toUpperCase()}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.actionDisabled,
  },
  label: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
});
