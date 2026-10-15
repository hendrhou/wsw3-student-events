import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { FieldError } from "./FieldError";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: string;
  error?: string;
}

/** Checkbox (components.md §4): 20px box, brand-primary checked, clickable label. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, className, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="cp-field">
      <label className={cn("cp-checkbox", className)} htmlFor={id}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {label}
      </label>
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
});
