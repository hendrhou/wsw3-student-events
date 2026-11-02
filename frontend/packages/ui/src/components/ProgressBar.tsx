import { cn } from "../utils/cn";

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Visible label, e.g. "42/60". Rendered beside the bar in tabular figures. */
  label?: string;
}

/** Capacity progress bar (components.md §8): primary fill, warning at ≥90%. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const warning = ratio >= 0.9;
  return (
    <span className="cp-progress">
      <span
        className="cp-progress__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span
          className={cn("cp-progress__fill", warning && "cp-progress__fill--warning")}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      {label ? <span className="cp-progress__label">{label}</span> : null}
    </span>
  );
}
