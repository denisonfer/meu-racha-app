import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { TAttendanceStatus } from "../racha-types";
import { attendanceQueueHint } from "../utils/attendance-cta";
import {
  ATTENDANCE_CONFIRMED_COUNT,
  ATTENDANCE_VIEW_LIST,
} from "../utils/racha-messages";

type TEventAttendanceCtaProps = {
  confirmedCount: number;
  spotLimit: number | null;
  myStatus: TAttendanceStatus | null;
  myQueuePosition: number | null;
  onOpenAttendance: () => void;
};

/**
 * Contagem informativa + dica de fila + “Ver lista” — telas 7 e 9.
 * Confirmar/cancelar mora na tela 20.
 */
export const EventAttendanceCta = ({
  confirmedCount,
  spotLimit,
  myStatus,
  myQueuePosition,
  onOpenAttendance,
}: TEventAttendanceCtaProps) => {
  const queueHint = attendanceQueueHint(myStatus, myQueuePosition);
  const confirmedLabel = ATTENDANCE_CONFIRMED_COUNT(confirmedCount);
  const countWord = confirmedCount === 1 ? "confirmado" : "confirmados";
  const spotsWord = spotLimit === 1 ? "vaga" : "vagas";

  return (
    <View style={styles.block}>
      <View
        style={[styles.countRow, spotLimit == null && styles.countRowSingle]}
        accessible
        accessibilityLabel={
          spotLimit == null
            ? confirmedLabel
            : `${confirmedLabel}. ${spotLimit} ${spotsWord} neste evento`
        }
      >
        <View style={styles.countItem}>
          <Text preset="stat" color="action" style={styles.countNum}>
            {confirmedCount}
          </Text>
          <Text preset="small" color="muted" style={styles.bold}>
            {countWord}
          </Text>
        </View>
        {spotLimit == null ? null : (
          <View style={styles.countItem}>
            <Text preset="stat" color="muted" style={styles.countNum}>
              {spotLimit}
            </Text>
            <Text preset="small" color="muted" style={styles.bold}>
              {spotsWord}
            </Text>
          </View>
        )}
      </View>
      {queueHint ? (
        <Text preset="small" color="muted">
          {queueHint}
        </Text>
      ) : null}
      <Button
        title={ATTENDANCE_VIEW_LIST}
        preset="primary"
        onPress={onOpenAttendance}
        accessibilityLabel={ATTENDANCE_VIEW_LIST}
        accessibilityHint="Abre a lista de presença"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 12 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  countRowSingle: { justifyContent: "flex-start" },
  countItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  countNum: {
    fontSize: 22,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  bold: { fontFamily: "Manrope-Bold" },
});
