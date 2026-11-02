import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { FieldError } from "./FieldError";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  helperText?: string;
  placeholder?: string;
}

/** Select (components.md §4): visible label, error below the field. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, helperText, required, disabled, placeholder, className, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn("cp-field", error && "cp-field--error", disabled && "cp-field--disabled")}>
      <label className="cp-field__label" htmlFor={id}>
        {label}
        {required ? <span className="cp-field__required" aria-hidden="true"> *</span> : null}
      </label>
      <div className="cp-field__control">
        <select
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={className}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {error ? <FieldError id={errorId} message={error} /> : helperText ? <span className="cp-field__helper">{helperText}</span> : null}
    </div>
  );
});
