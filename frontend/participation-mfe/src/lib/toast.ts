import { create } from "zustand";
import type { ToastData } from "@campus-pulse/ui";

interface ToastState {
  toasts: ToastData[];
  push: (toast: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

/** MFE-local toast store (top-right, 4s auto-dismiss handled by ToastRegion). */
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
