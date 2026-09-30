import { levelFromOverall, TCardLevel } from "@meu-racha/domain";
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text,
} from "react-native-svg";
import { CARD_LEVELS } from "./player-card-levels";

type TMiniLevelStyle = {
  background: readonly [string, string];
  frame: readonly string[];
  accent: string;
  photoFg: string;
};

const MINI_LEVELS: Record<TCardLevel, TMiniLevelStyle> = {
  base: {
    background: ["#8C523A", "#6B3F2E"],
    frame: ["#3B2216"],
    accent: "#F0DDC6",
    photoFg: "#D8AE90",
  },
  promessa: {
    background: ["#D5DDE6", "#9AA7B5"],
    frame: ["#55616F"],
    accent: "#FFFFFF",
    photoFg: "#E3E9EF",
  },
  craque: {
    background: ["#D9B45A", "#A98232"],
    frame: ["#4E360C"],
    accent: "#F3DFA8",
    photoFg: "#F3E0AC",
  },
  monstro: {
    background: ["#1A0B45", "#080418"],
    frame: ["#22E1FF", "#8B5CF6", "#FF3DDC"],
    accent: "#22E1FF",
    photoFg: "#C9E9FF",
  },
  lenda: {
    background: ["#0B0B12", "#020204"],
    frame: ["#BFE9FF", "#E7C6FF", "#FFE3F1", "#FFF6C9", "#C9FFE6"],
    accent: "#BFE9FF",
    photoFg: "#DDE2EC",
  },
};

// retângulo de cantos cortados da Lenda
const octagon = (x: number, y: number, w: number, h: number, cut: number) =>
  `M${x + cut} ${y}H${x + w - cut}L${x + w} ${y + cut}V${y + h - cut}` +
  `L${x + w - cut} ${y + h}H${x + cut}L${x} ${y + h - cut}V${y + cut}Z`;

export type TPlayerCardMiniProps = {
  width: number;
  overall: number;
  initials: string;
  photoUri: string | null;
};

export const PlayerCardMini = ({
  width,
  overall,
  initials,
  photoUri,
}: TPlayerCardMiniProps) => {
  const levelId = levelFromOverall(overall);
  const level = CARD_LEVELS[levelId];
  const mini = MINI_LEVELS[levelId];
  const isLenda = levelId === "lenda";

  const k = width / 44;
  const height = width * 1.4;
  const border = k >= 1.15 ? 2 : 1.5;
  const radius = Math.round(6 * k);
  const cut = Math.round(7 * k);
  const photo = Math.round(34 * k);
  const photoY = Math.round(5 * k);
  const cx = width / 2;
  const cy = photoY + photo / 2;
  const fontSize = Math.round(13 * k);

  // id único por instância: no web o id é global e os ":" do useId quebram o url(#…)
  const id = useId().replace(/:/g, "");
  const frameFill =
    mini.frame.length > 1 ? `url(#frame${id})` : (mini.frame[0] ?? "");

  const inner = {
    x: border,
    y: border,
    w: width - 2 * border,
    h: height - 2 * border,
  };

  return (
    <View
      style={[levelId === "monstro" && styles.glow, { width, height }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`bg${id}`} x1="0.4" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={mini.background[0]} />
            <Stop offset="1" stopColor={mini.background[1]} />
          </LinearGradient>
          <LinearGradient id={`frame${id}`} x1="0" y1="0" x2="1" y2="1">
            {mini.frame.map((color, index) => (
              <Stop
                key={color}
                offset={index / Math.max(mini.frame.length - 1, 1)}
                stopColor={color}
              />
            ))}
          </LinearGradient>
          <ClipPath id={`photo${id}`}>
            <Circle cx={cx} cy={cy} r={photo / 2} />
          </ClipPath>
        </Defs>

        {isLenda ? (
          <>
            <Path d={octagon(0, 0, width, height, cut)} fill={frameFill} />
            <Path
              d={octagon(inner.x, inner.y, inner.w, inner.h, cut - 1)}
              fill={`url(#bg${id})`}
            />
          </>
        ) : (
          <>
            <Rect width={width} height={height} rx={radius} fill={frameFill} />
            <Rect
              x={inner.x}
              y={inner.y}
              width={inner.w}
              height={inner.h}
              rx={radius - 1}
              fill={`url(#bg${id})`}
            />
          </>
        )}

        <Circle cx={cx} cy={cy} r={photo / 2} fill={level.photoBg} />
        {photoUri ? (
          <Image
            href={{ uri: photoUri }}
            x={cx - photo / 2}
            y={photoY}
            width={photo}
            height={photo}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#photo${id})`}
          />
        ) : (
          <Text
            x={cx}
            y={cy + fontSize * 0.36}
            textAnchor="middle"
            fontFamily="Manrope-ExtraBold"
            fontWeight="800"
            fontSize={fontSize}
            fill={mini.photoFg}
          >
            {initials}
          </Text>
        )}
        <Circle
          cx={cx}
          cy={cy}
          r={photo / 2}
          fill="none"
          stroke={mini.accent}
          strokeWidth={border}
        />

        <Text
          x={cx}
          y={photoY + photo + Math.round(4 * k) + fontSize * 0.85}
          textAnchor="middle"
          fontFamily="BarlowCondensed-Bold"
          fontWeight="700"
          fontSize={fontSize}
          fill={level.ink}
        >
          {overall}
        </Text>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  // Android não tem sombra colorida: lá o Monstro fica só com a moldura em gradiente
  glow: {
    shadowColor: "#22E1FF",
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
