export type TReportKind = "profile" | "racha";

export type TProfileReportReason =
  "photo" | "name" | "harassment" | "spam_scam" | "other";

export type TRachaReportReason = "name" | "scam_charge" | "other";

export type TReportReason = TProfileReportReason | TRachaReportReason;

export type TBlockedProfile = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  sharedRachaName: string | null;
};
