import {
  cardNameFit,
  initialsOf,
  levelFromOverall,
  TRoleBadge,
} from "@meu-racha/domain";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image,
  LinearGradient,
  Path,
  Rect,
  Stop,
  SvgXml,
  Text,
} from "react-native-svg";
import { CARD_BACKGROUNDS } from "./player-card-backgrounds";
import { CARD_LEVELS } from "./player-card-levels";
import { TCardStat } from "./player-card-stats";

const WIDTH = 320;
const HEIGHT = 448;
const VIEW_BOX = `0 0 ${WIDTH} ${HEIGHT}`;
const PIPS = [0, 1, 2, 3, 4];
const STAR_PATH =
  "M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z";

// O peso vai junto da família: sem ele o react-native-svg pede peso "normal" ao
// RCTFont, que troca a Manrope-ExtraBold pela Medium (a mais perto de 400) no iOS
const FONT = {
  score: { fontFamily: "BarlowCondensed-Bold", fontWeight: "700" },
  heavy: { fontFamily: "Manrope-ExtraBold", fontWeight: "800" },
  // o design system pede Manrope 600; o app não embarca o SemiBold
  meta: { fontFamily: "Manrope-Bold", fontWeight: "700" },
} as const;

export type TPlayerCardProps = {
  width: number;
  overall: number;
  /** null esconde a aba: no Cadastro, antes de escolher a Posição */
  badge: TRoleBadge | null;
  name: string;
  photoUri?: string | null;
  /** já na ordem certa: lineStats ou keeperStats */
  stats: TCardStat[];
  /** Racha e Temporada, ou o texto de exemplo da prévia */
  context: string;
  isSubscriber?: boolean;
  isSuperStar?: boolean;
};

export const PlayerCard = ({
  width,
  overall,
  badge,
  name,
  photoUri,
  stats,
  context,
  isSubscriber = false,
  isSuperStar = false,
}: TPlayerCardProps) => {
  const levelId = levelFromOverall(overall);
  const level = CARD_LEVELS[levelId];
  const height = width * (HEIGHT / WIDTH);
  const nameFit = cardNameFit(name);
  // a aba foi desenhada pra 3 letras (58); TODAS precisa de mais espaço
  const badgeWidth = badge && badge.length > 3 ? 78 : 58;
  // com 3 colunas sobra espaço e o rótulo cresce (é o que o preview faz)
  const statLabel =
    stats.length <= 3
      ? { fontSize: 12, letterSpacing: 0.7 }
      : { fontSize: 10, letterSpacing: 0.4 };

  return (
    <View
      style={{ width, height }}
      accessibilityRole="image"
      // no Cadastro o nome pode estar vazio; o leitor de tela não deve dizer "Carta de ,"
      accessibilityLabel={[
        name.trim() ? `Carta de ${name.trim()}` : "Carta",
        level.label,
        `overall ${overall}`,
      ].join(", ")}
    >
      <SvgXml
        xml={CARD_BACKGROUNDS[levelId]}
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        viewBox={VIEW_BOX}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <ClipPath id="photo">
            <Circle cx={160} cy={212} r={72} />
          </ClipPath>
          {level.overallGradient ? (
            <LinearGradient
              id="overall"
              x1={0}
              y1={0}
              x2={WIDTH}
              y2={HEIGHT}
              gradientUnits="userSpaceOnUse"
            >
              {level.overallGradient.map((color, i, all) => (
                <Stop
                  key={color}
                  offset={i / (all.length - 1)}
                  stopColor={color}
                />
              ))}
            </LinearGradient>
          ) : null}
        </Defs>

        <Circle cx={160} cy={212} r={72} fill={level.photoBg} />
        {photoUri ? (
          <Image
            href={{ uri: photoUri }}
            x={88}
            y={140}
            width={144}
            height={144}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#photo)"
          />
        ) : (
          <Text
            x={160}
            y={236}
            textAnchor="middle"
            {...FONT.heavy}
            fontSize={70}
            fill={level.photoFg}
          >
            {initialsOf(name)}
          </Text>
        )}

        {level.overallShadow ? (
          <Text
            x={26}
            y={98}
            transform="translate(2.5 2.5)"
            {...FONT.score}
            fontSize={88}
            fill={level.overallShadow}
          >
            {overall}
          </Text>
        ) : null}
        <Text
          x={26}
          y={98}
          {...FONT.score}
          fontSize={88}
          fill={level.overallGradient ? "url(#overall)" : level.ink}
        >
          {overall}
        </Text>

        {badge ? (
          <>
            <Rect
              x={26}
              y={108}
              width={badgeWidth}
              height={26}
              rx={6}
              fill={level.tab}
            />
            <Text
              x={26 + badgeWidth / 2}
              y={127}
              textAnchor="middle"
              {...FONT.heavy}
              fontSize={16}
              letterSpacing={1.2}
              fill={level.tabInk}
            >
              {badge}
            </Text>
          </>
        ) : null}

        <Text
          x={294}
          y={38}
          textAnchor="end"
          {...FONT.heavy}
          fontSize={12}
          letterSpacing={1.3}
          fill={level.inkSoft}
        >
          {level.label.toLocaleUpperCase("pt-BR")}
        </Text>
        {PIPS.map((i) =>
          i < level.pips ? (
            <Circle
              key={i}
              cx={237.5 + 13 * i}
              cy={55}
              r={4.5}
              fill={level.pip}
            />
          ) : (
            <Circle
              key={i}
              cx={237.5 + 13 * i}
              cy={55}
              r={3.6}
              fill="none"
              stroke={level.pip}
              strokeWidth={1.4}
              opacity={0.6}
            />
          )
        )}

        {isSuperStar ? (
          <>
            <Circle cx={262} cy={100} r={17} fill={level.tab} />
            <Circle
              cx={262}
              cy={100}
              r={13}
              fill="none"
              stroke={level.tabInk}
              strokeWidth={1.4}
              opacity={0.6}
            />
            <Path
              transform="translate(253 91) scale(.75)"
              d={STAR_PATH}
              fill={level.tabInk}
            />
          </>
        ) : null}

        <Text
          x={160}
          y={318}
          textAnchor="middle"
          {...FONT.heavy}
          fontSize={nameFit.fontSize}
          letterSpacing={0.6}
          fill={level.ink}
        >
          {nameFit.text}
        </Text>

        {stats.map((stat, i) => {
          const x = 18 + (284 * (i + 0.5)) / stats.length;
          return (
            <G key={stat.label}>
              <Text
                x={x}
                y={378}
                textAnchor="middle"
                {...FONT.score}
                fontSize={38}
                fill={level.ink}
              >
                {stat.value}
              </Text>
              <Text
                x={x}
                y={395}
                textAnchor="middle"
                {...FONT.heavy}
                fill={level.inkSoft}
                {...statLabel}
              >
                {stat.label}
              </Text>
            </G>
          );
        })}

        {isSubscriber ? (
          <>
            <Rect
              x={18}
              y={416}
              width={34}
              height={16}
              rx={8}
              fill={level.pip}
            />
            <Text
              x={35}
              y={428}
              textAnchor="middle"
              {...FONT.heavy}
              fontSize={9}
              letterSpacing={0.8}
              fill={level.tabInk}
            >
              PRO
            </Text>
          </>
        ) : null}
        <Text
          x={302}
          y={428}
          textAnchor="end"
          {...FONT.meta}
          fontSize={11}
          fill={level.inkSoft}
        >
          {context}
        </Text>
      </Svg>
    </View>
  );
};
