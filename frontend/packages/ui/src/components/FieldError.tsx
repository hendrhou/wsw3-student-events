export interface FieldErrorProps {
  id: string;
  message: string;
}

/** Inline field error: error icon + small text, announced via role="alert". */
export function FieldError({ id, message }: FieldErrorProps) {
  return (
    <span id={id} className="cp-field__error" role="alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {message}
    </span>
  );
}
