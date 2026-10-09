import {
  dayGroup,
  notificationFamily,
  notificationText,
  relativeWhen,
  type TDayGroup,
  type TNotification,
  type TNotificationFamily,
} from "@meu-racha/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { unseenNotificationsKey } from "../../hooks/use-unseen-notifications-count";
import { notificationApi } from "../../notification-api";
import {
  NOTIFICATIONS_EARLIER,
  NOTIFICATIONS_GONE_EVENT,
  NOTIFICATIONS_GONE_MEMBER,
  NOTIFICATIONS_GONE_RACHA,
  NOTIFICATIONS_NEW,
  NOTIFICATIONS_THIS_WEEK,
  NOTIFICATIONS_TODAY,
  NOTIFICATIONS_YESTERDAY,
  requestResolved,
} from "../../utils/notification-messages";
import {
  notificationHref,
  notificationIsUnavailable,
} from "./notification-href";

export { notificationHref } from "./notification-href";

export const notificationsKey = ["notifications"] as const;

const DAY_ORDER = ["today", "yesterday", "thisWeek", "earlier"] as const;

const DAY_TITLE: Record<TDayGroup, string> = {
  today: NOTIFICATIONS_TODAY,
  yesterday: NOTIFICATIONS_YESTERDAY,
  thisWeek: NOTIFICATIONS_THIS_WEEK,
  earlier: NOTIFICATIONS_EARLIER,
};

export type TNotificationListStatus = {
  tone: "success" | "muted";
  icon: "check" | "close" | "ban";
  text: string;
};

export type TNotificationListItem = {
  id: string;
  family: TNotificationFamily;
  text: string;
  rachaName: string;
  when: string;
  status?: TNotificationListStatus;
  isNew: boolean;
  isUnavailable: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
};

export type TNotificationSection = {
  key: string;
  title: string;
  isNew: boolean;
  data: TNotificationListItem[];
};

function rowStatus(notice: TNotification): TNotificationListStatus | undefined {
  if (notice.target === "event_cancelled") {
    return { tone: "muted", icon: "ban", text: NOTIFICATIONS_GONE_EVENT };
  }
  if (notice.target === "racha_deleted") {
    return { tone: "muted", icon: "ban", text: NOTIFICATIONS_GONE_RACHA };
  }
  if (notice.target === "not_member") {
    return { tone: "muted", icon: "ban", text: NOTIFICATIONS_GONE_MEMBER };
  }
  if (!notice.resolution) return undefined;
  const approved = notice.resolution.status === "approved";
  return {
    tone: approved ? "success" : "muted",
    icon: approved ? "check" : "close",
    text: requestResolved(
      approved,
      notice.resolution.byName,
      notice.resolution.byMe
    ),
  };
}

function rowLabel(
  text: string,
  rachaName: string,
  when: string,
  status: string | undefined,
  isNew: boolean,
  isUnavailable: boolean
): string {
  const parts = [text];
  if (status) parts.push(status);
  parts.push(rachaName, when);
  let label = parts.join(", ");
  if (isNew) label += ", novo";
  if (isUnavailable) label += ", indisponível";
  return label;
}

function toItem(
  notice: TNotification,
  isNew: boolean,
  now: Date
): TNotificationListItem {
  const text = notificationText(notice);
  const when = relativeWhen(notice.createdAt, now);
  const status = rowStatus(notice);
  const isUnavailable = notificationIsUnavailable(notice.target);
  const href = notificationHref(notice);
  return {
    id: notice.id,
    family: notificationFamily(notice.kind),
    text,
    rachaName: notice.rachaName,
    when,
    status,
    isNew,
    isUnavailable,
    // A função pura devolve string; o router só aceita o Href das rotas.
    onPress: href ? () => router.push(href as Href) : undefined,
    accessibilityLabel: rowLabel(
      text,
      notice.rachaName,
      when,
      status?.text,
      isNew,
      isUnavailable
    ),
  };
}

function buildSections(
  list: TNotification[],
  visitNewIds: ReadonlySet<string>,
  now: Date
): TNotificationSection[] {
  const fresh: TNotification[] = [];
  const byDay: Record<TDayGroup, TNotification[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  for (const notice of list) {
    if (visitNewIds.has(notice.id)) fresh.push(notice);
    else byDay[dayGroup(notice.createdAt, now)].push(notice);
  }

  const sections: TNotificationSection[] = [];
  if (fresh.length > 0) {
    sections.push({
      key: "new",
      title: NOTIFICATIONS_NEW,
      isNew: true,
      data: fresh.map((notice) => toItem(notice, true, now)),
    });
  }

  for (const day of DAY_ORDER) {
    const items = byDay[day];
    if (items.length === 0) continue;
    sections.push({
      key: day,
      title: DAY_TITLE[day],
      isNew: false,
      data: items.map((notice) => toItem(notice, false, now)),
    });
  }

  return sections;
}

export function useNotificationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationsKey,
    queryFn: () => notificationApi.getNotifications(),
  });
  const { refetch } = query;
  const focused = useRef(false);
  const [visitNewIds, setVisitNewIds] = useState<ReadonlySet<string> | null>(
    null
  );
  const [now, setNow] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyVisit = useCallback(
    async (isCurrent: () => boolean) => {
      const result = await refetch();
      if (!isCurrent() || result.error || !result.data) return;
      setNow(new Date());
      setVisitNewIds(
        new Set(result.data.filter((item) => item.isNew).map((item) => item.id))
      );
      try {
        await notificationApi.markNotificationsSeen();
        // Um fetch da contagem ainda no ar gravaria o número velho por cima do zero.
        await queryClient.cancelQueries({
          queryKey: unseenNotificationsKey,
          exact: true,
        });
        queryClient.setQueryData(unseenNotificationsKey, 0);
      } catch {
        // A lista já está na visita. O contador só zera se o visto gravou.
      }
    },
    [queryClient, refetch]
  );

  useFocusEffect(
    useCallback(() => {
      let current = true;
      focused.current = true;
      void applyVisit(() => current);
      return () => {
        current = false;
        focused.current = false;
        // Sair da aba encerra a visita: o destaque de Novos não continua.
        setVisitNewIds(new Set());
      };
    }, [applyVisit])
  );

  const sections = useMemo(() => {
    if (!query.data || !visitNewIds) return [];
    return buildSections(query.data, visitNewIds, now);
  }, [now, query.data, visitNewIds]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await applyVisit(() => focused.current);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyVisit]);

  const isLoading = !query.isError && (query.isPending || visitNewIds === null);
  const isError = query.isError && query.data === undefined;

  return {
    sections,
    isLoading,
    isError,
    isEmpty: !isLoading && !isError && (query.data?.length ?? 0) === 0,
    isRetrying: query.isRefetching,
    isRefreshing,
    retry: () => void applyVisit(() => focused.current),
    refresh,
  };
}
