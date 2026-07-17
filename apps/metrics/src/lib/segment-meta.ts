export type SalesSegmentId =
  | "stuck_failures"
  | "upgrade_ready"
  | "low_credits"
  | "no_export"
  | "churn_risk"
  | "never_started"
  | "new_hot"
  | "paid_champion"
  | "topup_upsell";

/** Client-safe segment labels (no server-only imports). */
export const SEGMENT_ORDER: {
  id: SalesSegmentId;
  label: string;
  priority: number;
}[] = [
  { id: "stuck_failures", label: "Stuck / failures", priority: 1 },
  { id: "upgrade_ready", label: "Upgrade ready", priority: 2 },
  { id: "low_credits", label: "Low credits", priority: 3 },
  { id: "topup_upsell", label: "Top-up → plan", priority: 4 },
  { id: "no_export", label: "Never exported", priority: 5 },
  { id: "churn_risk", label: "Churn risk", priority: 6 },
  { id: "new_hot", label: "New & active", priority: 7 },
  { id: "never_started", label: "Never started", priority: 8 },
  { id: "paid_champion", label: "Paid champion", priority: 9 },
];
