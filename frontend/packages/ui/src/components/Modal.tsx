import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  /** Danger confirmations place the destructive action left of Cancel. */
  dangerConfirm?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog (components.md §6): focus trap, Esc closes, focus returns to
 * the trigger on close, scrim neutral-900 @ 48% + blur.
 */
export function Modal({ open, onClose, title, size = "md", dangerConfirm = false, footer, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const dialog = ref.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- canonical scrim pattern; keyboard users close via Esc
    <div className="cp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={cn("cp-modal", size !== "md" && `cp-modal--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="cp-modal__header">
          <h2 className="cp-modal__title">{title}</h2>
          <button type="button" className="cp-modal__close" aria-label="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {children}
        {footer ? (
          <div className={cn("cp-modal__footer", dangerConfirm && "cp-modal__footer--danger-first")}>{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ScanResultModalProps {
  open: boolean;
  type: "success" | "warning" | "error" | "info";
  name: string;
  detail?: string;
  action?: ReactNode;
}

/** Full-screen glanceable scan result (organiser-mfe O4). */
export function ScanResultModal({ open, type, name, detail, action }: ScanResultModalProps) {
  if (!open) return null;
  return createPortal(
    <div className={cn("cp-scan-result", `cp-scan-result--${type}`)} role="alertdialog" aria-label={name}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        {type === "success" ? (
          <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      <p className="cp-scan-result__name">{name}</p>
      {detail ? <p className="cp-scan-result__detail">{detail}</p> : null}
      {action}
    </div>,
    document.body,
  );
}
