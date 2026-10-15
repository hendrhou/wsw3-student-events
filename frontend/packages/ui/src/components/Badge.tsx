import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type BadgeType = "success" | "warning" | "error" | "info" | "neutral" | "accent";

export interface BadgeProps {
  type: BadgeType;
  children: ReactNode;
}

/**
 * Status badge (components.md §5). Status is never conveyed by color alone —
 * the dot is paired with an uppercase text label. `accent` (gold) is reserved
 * for semantic recommendations and pending-attention items.
 */
export function Badge({ type, children }: BadgeProps) {
  return (
    <span className={cn("cp-badge", `cp-badge--${type}`)}>
      <span className="cp-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
