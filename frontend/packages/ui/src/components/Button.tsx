import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
}

/**
 * Shared button (components.md §1). Loading swaps the label for a spinner,
 * locks width semantics via aria-busy, and disables interaction.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, iconLeft, className, children, type, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn("cp-btn", `cp-btn--${variant}`, size !== "md" && `cp-btn--${size}`, className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="cp-btn__spinner" role="status" aria-label="Loading" />
      ) : (
        <>
          {iconLeft}
          {children}
        </>
      )}
    </button>
  );
});
