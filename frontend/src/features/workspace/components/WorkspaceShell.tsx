import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { MoonIcon, RedoIcon, SearchIcon, SunIcon, UndoIcon } from '@/components/icons';
import { CommandPalette } from '@/features/workspace/components/CommandPalette';
import { WorkspacePage } from '@/features/workspace/components/WorkspacePage';
import { useWorkspace } from '@/features/workspace/hooks/use-workspace';
import { useWorkspaceSync } from '@/features/workspace/hooks/use-workspace-sync';
import { useHistoryStore } from '@/features/workspace/stores/history-store';
import { authToken } from '@/lib/api/client';
import { queryClient } from '@/lib/query-client';
import { useUiStore } from '@/stores/ui-store';
import type { User } from '@/types/api';

export function WorkspaceShell({ user }: { user: User }) {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const theme = useUiStore((state) => state.theme);
  const commandOpen = useUiStore((state) => state.commandOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const undoStack = useHistoryStore((state) => state.undoStack);
  const redoStack = useHistoryStore((state) => state.redoStack);

  useWorkspaceSync();

  const logout = useCallback(async () => {
    authToken.clear();
    useHistoryStore.getState().reset();
    queryClient.clear();
    await navigate({ to: '/login', replace: true });
  }, [navigate]);

  useEffect(() => {
    const onUnauthorized = () => void logout();
    window.addEventListener('float:unauthorized', onUnauthorized);
    return () => window.removeEventListener('float:unauthorized', onUnauthorized);
  }, [logout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = Boolean(target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || target.closest('[contenteditable]')));
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      if (mod && key === 'k') {
        event.preventDefault();
        setCommandOpen(!useUiStore.getState().commandOpen);
        return;
      }
      if (editable) return;
      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) void useHistoryStore.getState().redo();
        else void useHistoryStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandOpen]);

  const openCount = workspace.tasks.filter((task) => !task.is_done).length;

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 md:px-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-text">float</span>
            <span className="text-xs text-text-muted">{openCount} open</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button aria-label="search" className="icon-button" onClick={() => setCommandOpen(true)} title="Search (⌘K)" type="button"><SearchIcon size={15} /></button>
            <button className="icon-button" disabled={!undoStack.length} onClick={() => void useHistoryStore.getState().undo()} title="Undo (⌘Z)" type="button"><UndoIcon size={15} /></button>
            <button className="icon-button" disabled={!redoStack.length} onClick={() => void useHistoryStore.getState().redo()} title="Redo (⌘⇧Z)" type="button"><RedoIcon size={15} /></button>
            <button aria-label="toggle theme" className="icon-button" onClick={toggleTheme} type="button">{theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}</button>
            <ProfileMenu onLogout={() => void logout()} user={user} />
          </div>
        </div>
      </header>

      <WorkspacePage workspace={workspace} />
      {commandOpen ? <CommandPalette onOpenChange={setCommandOpen} open workspace={workspace} /> : null}
    </div>
  );
}

function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative ml-0.5" ref={ref}>
      <button aria-label="account" className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg transition-transform hover:scale-105" onClick={() => setOpen((value) => !value)} type="button">
        {user.username.slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div className="modal-in absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-elevated/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-xs text-text-secondary">{user.username}</p>
          </div>
          <button className="flex w-full items-center px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface/70 hover:text-danger" onClick={onLogout} type="button">sign out</button>
        </div>
      ) : null}
    </div>
  );
}
