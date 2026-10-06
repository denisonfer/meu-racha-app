import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  BOLINHAS_CLOSE,
  bolinhasColumnCount,
  bolinhasGiverToReceiver,
  bolinhasGoes,
  bolinhasLegend,
  bolinhasStays,
} from "../../utils/racha-messages";
import { BolinhasBag } from "./bolinhas-bag";
import { BolinhasRevealBall } from "./bolinhas-reveal-ball";
import { BolinhasRevealColumn } from "./bolinhas-reveal-column";
import {
  BAG_WIDTH,
  COLUMN_BALL_Y,
  COLUMN_HEIGHT,
  COLUMN_STEP,
  COLUMN_TOP,
  DIVIDER_Y,
  SLOT_SIZE,
  SLOT_TOP,
  startOf,
} from "./bolinhas-reveal-timeline";
import { useBolinhasReveal } from "./use-bolinhas-reveal";

/** R1 e R2: a revelação, só no aparelho do Condutor. Posições do handoff, num palco de 390 pt. */
export const BolinhasRevealScreen = () => {
  const r = useBolinhasReveal();
  const { width } = useWindowDimensions();
  // o palco sai do padding de 16 da Screen para ocupar a largura toda, como no handoff
  const stageWidth = width;
  const pending = r.pending;
  if (!pending) {
    return (
      <Screen title="Bolinhas" canGoBack>
        <Button title={BOLINHAS_CLOSE} onPress={r.goBack} />
      </Screen>
    );
  }

  const count = r.order.length;
  const spacing = Math.min(
    80,
    (stageWidth - 40 - SLOT_SIZE) / Math.max(1, count - 1)
  );
  const slotSize = Math.min(SLOT_SIZE, spacing - 6);
  const cardWidth = (stageWidth - 40 - 16) / 2;
  const stayLeft = 20;
  const goLeft = 20 + cardWidth + 16;
  const stayX = stayLeft + 36;
  const goX = goLeft + 36;
  const columnHeight = Math.max(
    COLUMN_HEIGHT,
    COLUMN_BALL_Y - COLUMN_TOP + Math.max(r.blueCount, r.redCount) * COLUMN_STEP
  );

  return (
    <Screen title={r.title} canGoBack={r.isDone} onGoBack={r.close}>
      <Text preset="small" color="muted" style={styles.sub}>
        {bolinhasGiverToReceiver(
          pending.giverTeamNumber,
          pending.receiverTeamNumber
        )}
      </Text>
      <View style={[styles.stage, { marginHorizontal: -theme.space[16] }]}>
        <View style={styles.legend}>
          <Text preset="caption" style={styles.legendItem}>
            <Text color="bolinhaAzul">●</Text>{" "}
            {bolinhasLegend(r.blueCount, true)}
          </Text>
          <Text preset="caption" style={styles.legendItem}>
            <Text color="bolinhaVermelha">●</Text>{" "}
            {bolinhasLegend(r.redCount, false)}
          </Text>
        </View>

        <BolinhasBag
          clock={r.clock}
          timeline={r.timeline}
          left={(stageWidth - BAG_WIDTH) / 2}
        />

        <View style={[styles.divider, { top: DIVIDER_Y }]} />
        {r.order.map((pick, index) => (
          <View
            key={`slot:${pick.personId}`}
            style={[
              styles.slot,
              {
                width: slotSize,
                height: slotSize,
                borderRadius: slotSize / 2,
                left:
                  stageWidth / 2 +
                  (index - (count - 1) / 2) * spacing -
                  slotSize / 2,
                top: SLOT_TOP + (SLOT_SIZE - slotSize) / 2,
              },
            ]}
          />
        ))}

        <BolinhasRevealColumn
          left={stayLeft}
          top={COLUMN_TOP}
          width={cardWidth}
          height={columnHeight}
          title={bolinhasStays(pending.giverTeamNumber)}
          countText={bolinhasColumnCount(r.arrived.red, r.redCount)}
          isBlue={false}
          isHighlighted={false}
        />
        <BolinhasRevealColumn
          left={goLeft}
          top={COLUMN_TOP}
          width={cardWidth}
          height={columnHeight}
          title={bolinhasGoes(pending.receiverTeamNumber)}
          countText={bolinhasColumnCount(r.arrived.blue, r.blueCount)}
          isBlue
          isHighlighted={r.arrived.blue > 0}
        />

        {r.order.map((pick, index) => {
          const isBlue = pick.color === "blue";
          // contagem pura, sem contador mutado no render (o React Compiler reordena o render)
          const column = r.order
            .slice(0, index)
            .filter((other) => other.color === pick.color).length;
          const slotX = stageWidth / 2 + (index - (count - 1) / 2) * spacing;
          return (
            <BolinhasRevealBall
              key={pick.personId}
              clock={r.clock}
              timeline={r.timeline}
              startMs={startOf(r.timeline, index)}
              name={pick.name}
              color={pick.color}
              colorText={isBlue ? "AZUL · vai" : "VERMELHA · fica"}
              labelColor={theme.colors.foreground}
              geometry={{
                mouthX: stageWidth / 2,
                // a primeira e a última sobem um pouco para fora do centro; a do meio, reto
                apexX:
                  (stageWidth / 2 + slotX) / 2 +
                  (Math.abs(slotX - stageWidth / 2) < 1
                    ? 0
                    : slotX < stageWidth / 2
                      ? -10
                      : 10),
                slotX,
                slotSize,
                colX: isBlue ? goX : stayX,
                colY: COLUMN_BALL_Y + column * COLUMN_STEP,
              }}
            />
          );
        })}

        <View style={styles.footer}>
          {r.isDone ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.close}>
              <Button title={BOLINHAS_CLOSE} onPress={r.close} />
            </Animated.View>
          ) : (
            <Text
              preset="small"
              color="muted"
              accessibilityRole="summary"
              accessibilityLiveRegion="polite"
              style={styles.progress}
            >
              {r.progress}
            </Text>
          )}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sub: { marginBottom: 4 },
  stage: { flex: 1 },
  legend: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  legendItem: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
  divider: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  slot: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.colors.divider,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  close: { alignSelf: "stretch" },
  progress: { height: 52, textAlignVertical: "center", lineHeight: 52 },
});
