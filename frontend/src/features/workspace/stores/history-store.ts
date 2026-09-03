import { create } from 'zustand';

import { toast } from '@/stores/toast-store';

export interface HistoryAction {
  redo: () => Promise<void>;
  undo: () => Promise<void>;
}

interface HistoryState {
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
  recentlyAdded: Set<string>;
  doneThisSession: Set<string>;
  push: (action: HistoryAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  markRecentlyAdded: (id: string) => void;
  trackDone: (id: string, isDone: boolean) => void;
  reset: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  recentlyAdded: new Set(),
  doneThisSession: new Set(),
  push: (action) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-29), action],
      redoStack: [],
    })),
  undo: async () => {
    const state = get();
    const action = state.undoStack.at(-1);
    if (!action) return;
    set({ undoStack: state.undoStack.slice(0, -1) });
    try {
      await action.undo();
      set((current) => ({ redoStack: [...current.redoStack, action] }));
    } catch {
      set((current) => ({ undoStack: [...current.undoStack, action] }));
      toast.error('Failed to undo');
    }
  },
  redo: async () => {
    const state = get();
    const action = state.redoStack.at(-1);
    if (!action) return;
    set({ redoStack: state.redoStack.slice(0, -1) });
    try {
      await action.redo();
      set((current) => ({ undoStack: [...current.undoStack, action] }));
    } catch {
      set((current) => ({ redoStack: [...current.redoStack, action] }));
      toast.error('Failed to redo');
    }
  },
  markRecentlyAdded: (id) => {
    set((state) => ({ recentlyAdded: new Set([...state.recentlyAdded, id]) }));
    window.setTimeout(() => {
      set((state) => {
        const next = new Set(state.recentlyAdded);
        next.delete(id);
        return { recentlyAdded: next };
      });
    }, 300);
  },
  trackDone: (id, isDone) =>
    set((state) => {
      const next = new Set(state.doneThisSession);
      if (isDone) next.add(id);
      else next.delete(id);
      return { doneThisSession: next };
    }),
  reset: () =>
    set({
      undoStack: [],
      redoStack: [],
      recentlyAdded: new Set(),
      doneThisSession: new Set(),
    }),
}));
