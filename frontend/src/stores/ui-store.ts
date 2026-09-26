import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  commandOpen: boolean;
  workspaceView: 'week' | 'projects';
  commandDate: string | null;
  setCommandOpen: (open: boolean) => void;
  openTaskComposer: (date?: string) => void;
  setWorkspaceView: (view: 'week' | 'projects') => void;
  toggleTheme: () => void;
}

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const useUiStore = create<UiState>()(
  (set) => ({
    theme: storedTheme(),
    commandOpen: false,
    workspaceView: 'week',
    commandDate: null,
    setCommandOpen: (commandOpen) => set({ commandOpen, commandDate: null }),
    openTaskComposer: (date) => set({ commandOpen: true, commandDate: date ?? null }),
    setWorkspaceView: (workspaceView) => set({ workspaceView }),
    toggleTheme: () =>
      set((state) => {
        const theme = state.theme === 'dark' ? 'light' : 'dark';
        try { window.localStorage.setItem('float_theme', theme); } catch { /* Theme still works when storage is unavailable. */ }
        return { theme };
      }),
  }),
);

function storedTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem('float_theme');
    return stored === 'light' || stored === 'dark' ? stored : preferredTheme();
  } catch {
    return preferredTheme();
  }
}
