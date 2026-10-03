import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { AttendanceRow } from "../../components/attendance-row";
import {
  ATTENDANCE_ADD_GUEST,
  ATTENDANCE_EMPTY,
  ATTENDANCE_EVENT_GONE_ACTION,
  ATTENDANCE_EVENT_GONE_TEXT,
  ATTENDANCE_EVENT_GONE_TITLE,
  ATTENDANCE_QUEUE_PAY_NOTE,
} from "../../utils/racha-messages";
import { useAttendanceScreen } from "./use-attendance-screen";

export const AttendanceScreen = () => {
  const {
    isLoading,
    isError,
    isMissingEvent,
    summary,
    isAdmin,
    eventIsPaid,
    canAddGuest,
    myAttendance,
    confirmedCount,
    confirmedGroups,
    showConfirmedGroupTitles,
    waitlistedRows,
    cancelledGroups,
    showCancelledGroupTitles,
    cancelledCount,
    isCancelledOpen,
    toggleCancelled,
    openGuest,
    backToRacha,
    retry,
    isRetrying,
  } = useAttendanceScreen();

  if (isMissingEvent) {
    return (
      <Screen title="Presença" canGoBack>
        <EmptyState
          title={ATTENDANCE_EVENT_GONE_TITLE}
          text={ATTENDANCE_EVENT_GONE_TEXT}
          actionLabel={ATTENDANCE_EVENT_GONE_ACTION}
          onAction={backToRacha}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Presença" canGoBack isScrollable>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel="Carregando presença"
        />
      ) : isError || !summary ? (
        <EmptyState
          title="Não deu pra abrir a presença"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.summary}>
            <Text preset="small" color="muted" style={styles.bold}>
              {summary.top}
            </Text>
            <Text preset="stat" style={styles.when}>
              {summary.when}
            </Text>
            <Text style={styles.bold}>{summary.place}</Text>
            <View style={styles.capacity}>
              <Text preset="stat" color="action" style={styles.capacityNum}>
                {summary.confirmedCount}
              </Text>
              <Text preset="small" color="muted" style={styles.bold}>
                {summary.capacityText.replace(/^\d+ /, "")}
              </Text>
            </View>
          </View>

          <Button
            title={myAttendance.title}
            preset={myAttendance.preset}
            onPress={myAttendance.onPress}
            isLoading={myAttendance.isLoading}
            accessibilityLabel={myAttendance.title}
          />

          <View style={styles.sectionHead}>
            <Text preset="h3">Confirmados · {confirmedCount}</Text>
            {canAddGuest ? (
              <Pressable
                onPress={openGuest}
                accessibilityRole="button"
                accessibilityLabel={ATTENDANCE_ADD_GUEST}
              >
                <Text preset="small" color="action" style={styles.bold}>
                  + {ATTENDANCE_ADD_GUEST}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {confirmedCount === 0 ? (
            <Text preset="small" color="muted" style={styles.empty}>
              {ATTENDANCE_EMPTY}
            </Text>
          ) : (
            <>
              {isAdmin ? (
                <View style={styles.colHead}>
                  <Text preset="caption" color="muted" style={styles.colLabel}>
                    VEIO
                  </Text>
                  {eventIsPaid ? (
                    <Text
                      preset="caption"
                      color="muted"
                      style={styles.colLabel}
                    >
                      PAGO
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {confirmedGroups.map((group) => (
                <View key={group.key} style={styles.group}>
                  {showConfirmedGroupTitles ? (
                    <Text
                      preset="small"
                      color="muted"
                      style={styles.groupTitle}
                    >
                      {group.label} · {group.rows.length}
                    </Text>
                  ) : null}
                  <View style={styles.listCard}>
                    {group.rows.map(({ key, ...row }, index) => (
                      <View
                        key={key}
                        style={index > 0 ? styles.rowDivider : undefined}
                      >
                        <AttendanceRow {...row} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {waitlistedRows.length > 0 ? (
            <>
              <View style={[styles.sectionHead, styles.sectionGap]}>
                <Text preset="h3">
                  Lista de espera · {waitlistedRows.length}
                </Text>
              </View>
              <View style={styles.listCard}>
                {waitlistedRows.map(({ key, ...row }, index) => (
                  <View
                    key={key}
                    style={index > 0 ? styles.rowDivider : undefined}
                  >
                    <AttendanceRow {...row} />
                  </View>
                ))}
              </View>
              {isAdmin ? (
                <Text preset="small" color="muted" style={styles.note}>
                  {ATTENDANCE_QUEUE_PAY_NOTE}
                </Text>
              ) : null}
            </>
          ) : null}

          {cancelledCount > 0 ? (
            <>
              <Pressable
                onPress={toggleCancelled}
                accessibilityRole="button"
                accessibilityState={{ expanded: isCancelledOpen }}
                style={styles.cancelledToggle}
              >
                <Text preset="small" color="muted" style={styles.bold}>
                  Cancelados · {cancelledCount} {isCancelledOpen ? "↑" : "↓"}
                </Text>
              </Pressable>
              {isCancelledOpen
                ? cancelledGroups.map((group) => (
                    <View key={group.key} style={styles.group}>
                      {showCancelledGroupTitles ? (
                        <Text
                          preset="small"
                          color="muted"
                          style={styles.groupTitle}
                        >
                          {group.label} · {group.rows.length}
                        </Text>
                      ) : null}
                      <View style={styles.listCard}>
                        {group.rows.map(({ key, ...row }, index) => (
                          <View
                            key={key}
                            style={index > 0 ? styles.rowDivider : undefined}
                          >
                            <AttendanceRow {...row} />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                : null}
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: theme.space[24],
  },
  summary: {
    gap: 4,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  bold: { fontFamily: "Manrope-Bold" },
  when: {
    fontSize: 28,
    lineHeight: 30,
    marginTop: 6,
  },
  capacity: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 12,
  },
  capacityNum: {
    fontSize: 28,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionGap: { marginTop: 18 },
  colHead: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 4,
    paddingRight: 10,
  },
  colLabel: {
    width: 43,
    textAlign: "center",
    fontFamily: "Manrope-ExtraBold",
    letterSpacing: 0.4,
  },
  group: { gap: 2, marginBottom: 8 },
  groupTitle: {
    paddingTop: 8,
    paddingBottom: 6,
    fontFamily: "Manrope-Bold",
  },
  listCard: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  empty: { marginBottom: 12 },
  note: { marginTop: 4, marginBottom: 8, lineHeight: 17 },
  cancelledToggle: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
});
