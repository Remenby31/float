import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleTheme: () => void;
}

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const useUiStore = create<UiState>()(
  (set) => ({
    theme: storedTheme(),
    commandOpen: false,
    setCommandOpen: (commandOpen) => set({ commandOpen }),
    toggleTheme: () =>
      set((state) => {
        const theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('float_theme', theme);
        return { theme };
      }),
  }),
);

function storedTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('float_theme');
  return stored === 'light' || stored === 'dark' ? stored : preferredTheme();
}
