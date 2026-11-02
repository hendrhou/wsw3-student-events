import { cn } from "../utils/cn";

export interface FilterChipProps {
  label: string;
  active?: boolean;
  /** When provided, renders a visible × button; Delete key also removes. */
  onRemove?: () => void;
  onClick?: () => void;
}

/** Removable filter pill (components.md §8). Active = primary-subtle. */
export function FilterChip({ label, active = false, onRemove, onClick }: FilterChipProps) {
  return (
    <span
      className={cn("cp-chip", active && "cp-chip--active")}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onRemove && (e.key === "Delete" || e.key === "Backspace")) onRemove();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          className="cp-chip__remove"
          aria-label={`Remove filter ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
