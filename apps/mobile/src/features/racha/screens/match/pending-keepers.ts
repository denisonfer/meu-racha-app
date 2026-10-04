export type TPendingKeepers = Record<string, string>;

export const pendingKeepersKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "pending-keepers"] as const;
