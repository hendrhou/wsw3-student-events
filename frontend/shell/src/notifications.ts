import { create } from "zustand";
import type { ToastData } from "@campus-pulse/ui";
import type { Notification } from "@campus-pulse/contracts";

export const useNotifications = create<{
  toasts: ToastData[];
  push: (notification: Notification) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}>((set) => ({
  toasts: [],
  push: (notification) => set((state) => ({ toasts: [...state.toasts, { ...notification, id: crypto.randomUUID() }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));