import { create } from 'zustand';

export type ToastKind = 'error' | 'success';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, kind = 'error') => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 4_000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  error: (message: string) => useToastStore.getState().add(message, 'error'),
  success: (message: string) => useToastStore.getState().add(message, 'success'),
};
