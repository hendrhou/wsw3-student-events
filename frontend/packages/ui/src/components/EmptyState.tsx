import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  guidance?: string;
  /** Exactly one recovery action. */
  action?: ReactNode;
}

/** Empty state (components.md §8): message + guidance + one action, no illustrations. */
export function EmptyState({ title, guidance, action }: EmptyStateProps) {
  return (
    <div className="cp-empty">
      <h3 className="cp-empty__title">{title}</h3>
      {guidance ? <p className="cp-empty__guidance">{guidance}</p> : null}
      {action ? <div className="cp-empty__action">{action}</div> : null}
    </div>
  );
}
