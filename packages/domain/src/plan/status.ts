// formato de get_my_plan; nulos quando a pessoa nunca assinou
export type TMyPlan = {
  isPro: boolean;
  expiresAt: Date | null;
  isTrial: boolean | null;
  willRenew: boolean | null;
  billingIssueAt: Date | null;
  productId: string | null;
  ownedRachaCount: number;
  canCreateRacha: boolean;
};

export type TPlanStatus =
  | { kind: "free" }
  | { kind: "trial" | "renewing" | "ending" | "billing_issue"; until: Date };

export function getPlanStatus(plan: TMyPlan, now: Date): TPlanStatus {
  const until = plan.expiresAt;
  if (!until || until <= now) return { kind: "free" };
  if (plan.billingIssueAt) return { kind: "billing_issue", until };
  if (plan.isTrial) return { kind: "trial", until };
  if (plan.willRenew === false) return { kind: "ending", until };
  return { kind: "renewing", until };
}
