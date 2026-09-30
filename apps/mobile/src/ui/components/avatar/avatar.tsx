import { initialsOf } from "@meu-racha/domain";
import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, Image, Text } from "react-native-svg";
import { theme, TThemeColor } from "@/ui/theme";

export type TAvatarProps = {
  name: string;
  photoUrl: string | null;
  size: number;
  /** Sobre a folha (surfaceRaised), o círculo precisa de outro tom para não sumir. */
  backgroundColor?: TThemeColor;
};

export const Avatar = ({
  name,
  photoUrl,
  size,
  backgroundColor = "surfaceRaised",
}: TAvatarProps) => {
  const radius = size / 2;
  const fontSize = size >= 48 ? 16 : 14;
  // id único por instância: no web o id é global e os ":" do useId quebram o url(#…)
  const clipId = `avatarClip${useId().replace(/:/g, "")}`;

  return (
    <Svg width={size} height={size} accessible={false}>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={radius} cy={radius} r={radius} />
        </ClipPath>
      </Defs>
      <Circle
        cx={radius}
        cy={radius}
        r={radius}
        fill={theme.colors[backgroundColor]}
      />
      {photoUrl ? (
        <Image
          href={{ uri: photoUrl }}
          x={0}
          y={0}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <Text
          x={radius}
          y={radius + fontSize * 0.34}
          textAnchor="middle"
          fontFamily="Manrope-ExtraBold"
          fontWeight="800"
          fontSize={fontSize}
          fill={theme.colors.foreground}
        >
          {initialsOf(name)}
        </Text>
      )}
    </Svg>
  );
};
