import { STARS_MAX, STARS_MIN } from "@meu-racha/domain";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/ui/components";
import { theme } from "@/ui/theme";
import { starsLabel } from "../utils/racha-labels";

type TStarRatingProps = {
  value: number | null;
  onChange: (value: number) => void;
  isDisabled?: boolean;
};

const STARS = Array.from(
  { length: STARS_MAX - STARS_MIN + 1 },
  (_, index) => STARS_MIN + index
);

export const StarRating = ({
  value,
  onChange,
  isDisabled = false,
}: TStarRatingProps) => (
  <View
    accessibilityRole="radiogroup"
    accessibilityLabel="Estrelas"
    style={styles.row}
  >
    {STARS.map((star) => {
      const isFilled = value !== null && star <= value;
      return (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          disabled={isDisabled}
          accessibilityRole="radio"
          accessibilityLabel={starsLabel(star)}
          accessibilityState={{ checked: value === star, disabled: isDisabled }}
          style={styles.star}
        >
          <Icon
            name="star"
            size={40}
            strokeWidth={1.6}
            color={isFilled ? "action" : "muted"}
            fill={isFilled ? "action" : undefined}
          />
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.space[4], marginLeft: -8 },
  star: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
});
