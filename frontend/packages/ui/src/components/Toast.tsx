import { useEffect } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONS: Record<ToastType, string> = {
  success: "#1e7e34",
  error: "#b3261e",
  info: "#1d5fa8",
  warning: "#9a6a00",
};

function ToastIcon({ type }: { type: ToastType }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke={ICONS[type]} strokeWidth="1.5" />
      {type === "success" ? (
        <path d="m9 12 2 2 4-4" stroke={ICONS[type]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M12 8v4M12 16h.01" stroke={ICONS[type]} strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Toast region (components.md §8): top-right, 4s auto-dismiss, aria-live
 * polite, max 3 stacked. Rendered via portal.
 */
export function ToastRegion({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  const visible = toasts.slice(-3);
  return createPortal(
    <div className="cp-toast-region" aria-live="polite" aria-label="Notifications">
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="cp-toast" role="status">
      <ToastIcon type={toast.type} />
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className="cp-toast__action"
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
