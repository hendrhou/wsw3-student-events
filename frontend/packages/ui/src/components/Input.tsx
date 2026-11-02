import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { FieldError } from "./FieldError";

interface FieldShellProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, error, helperText, required, readOnly, disabled, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn("cp-field", error && "cp-field--error", disabled && "cp-field--disabled", readOnly && "cp-field--readonly")}>
      <label className="cp-field__label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span className="cp-field__required" aria-hidden="true"> *</span>
            <span className="cp-sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}> (required)</span>
          </>
        ) : null}
      </label>
      {children(id, error ? errorId : undefined)}
      {error ? <FieldError id={errorId} message={error} /> : helperText ? <span className="cp-field__helper">{helperText}</span> : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  helperText?: string;
}

/** Text input (components.md §4): visible label always, 44px target, error below. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, required, readOnly, disabled, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} helperText={helperText} required={required} readOnly={readOnly} disabled={disabled}>
      {(id, describedBy) => (
        <div className="cp-field__control">
          <input
            ref={ref}
            id={id}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={className}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
});

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  helperText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, helperText, required, readOnly, disabled, maxLength, value, className, ...rest },
  ref,
) {
  const length = typeof value === "string" ? value.length : 0;
  return (
    <FieldShell label={label} error={error} helperText={helperText} required={required} readOnly={readOnly} disabled={disabled}>
      {(id, describedBy) => (
        <>
          <div className="cp-field__control">
            <textarea
              ref={ref}
              id={id}
              required={required}
              readOnly={readOnly}
              disabled={disabled}
              maxLength={maxLength}
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={className}
              {...rest}
            />
          </div>
          {maxLength ? (
            <span className="cp-field__helper cp-tabular" aria-live="off">
              {length}/{maxLength}
            </span>
          ) : null}
        </>
      )}
    </FieldShell>
  );
});
