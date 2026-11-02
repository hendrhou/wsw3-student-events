import { cn } from "../utils/cn";

export interface StepIndicatorProps {
  steps: string[];
  /** 0-based index of the current step. Steps before it render as done. */
  current: number;
}

/** Numbered steps + connectors (components.md §8). Done = success check. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="cp-steps" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} style={{ display: "contents" }}>
            {i > 0 ? (
              <span className={cn("cp-steps__connector", state === "done" && "cp-steps__connector--done")} aria-hidden="true" />
            ) : null}
            <span
              className={cn("cp-steps__item", state !== "todo" && `cp-steps__item--${state}`)}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="cp-steps__dot" aria-hidden="true">
                {state === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="cp-steps__label">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
