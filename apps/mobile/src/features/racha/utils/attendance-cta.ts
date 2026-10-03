import { TAttendanceStatus } from "../racha-types";
import {
  ATTENDANCE_CANCEL,
  ATTENDANCE_CONFIRM,
  ATTENDANCE_LEAVE_QUEUE,
  ATTENDANCE_QUEUE_HINT,
} from "./racha-messages";

export type TAttendanceCta = {
  kind: "confirm" | "cancelAttendance";
  title: string;
  preset: "primary" | "secondary" | "destructiveOutline";
};

/**
 * CTA da própria presença na tela 20.
 * confirm → confirmar; cancelAttendance cobre Cancelar e Sair da fila.
 */
export function attendanceCta(
  myStatus: TAttendanceStatus | null
): TAttendanceCta {
  if (myStatus === "confirmed") {
    return {
      kind: "cancelAttendance",
      title: ATTENDANCE_CANCEL,
      preset: "secondary",
    };
  }
  if (myStatus === "waitlisted") {
    return {
      kind: "cancelAttendance",
      title: ATTENDANCE_LEAVE_QUEUE,
      preset: "secondary",
    };
  }
  return {
    kind: "confirm",
    title: ATTENDANCE_CONFIRM,
    preset: "primary",
  };
}

export function attendanceQueueHint(
  myStatus: TAttendanceStatus | null,
  myQueuePosition: number | null
): string | null {
  if (myStatus !== "waitlisted" || myQueuePosition == null) return null;
  return ATTENDANCE_QUEUE_HINT(myQueuePosition);
}
