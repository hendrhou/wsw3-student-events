import { cn } from "../utils/cn";

export interface StatCardProps {
  value: string | number;
  label: string;
  /** Gold accent fill — reserved for pending-attention items (e.g. pending check-in). */
  accent?: boolean;
}

/** StatCard (components.md §2): H2 tabular figure + caption label, flat shadow-1. */
export function StatCard({ value, label, accent = false }: StatCardProps) {
  return (
    <div className={cn("cp-stat", accent && "cp-stat--accent")}>
      <p className="cp-stat__value">{value}</p>
      <span className="cp-stat__label">{label}</span>
    </div>
  );
}
