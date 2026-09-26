import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { MoonIcon, RedoIcon, SearchIcon, SunIcon, UndoIcon } from '@/components/icons';
import { Brand } from '@/components/Brand';
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
  const commandDate = useUiStore((state) => state.commandDate);
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

  return (
    <div className="min-h-screen bg-bg text-text">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="app-masthead safe-top">
        <div className="masthead-inner">
          <div className="masthead-brand">
            <Brand />
            <span className="eyebrow masthead-tagline">Make room for what matters.</span>
          </div>
          <div className="masthead-actions">
            <button aria-label="search" className="search-trigger" onClick={() => setCommandOpen(true)} title="Search (⌘K)" type="button"><SearchIcon size={16} /><span>Find anything</span><kbd>⌘ K</kbd></button>
            <div className="history-controls flex">
              <button className="icon-button" disabled={!undoStack.length} onClick={() => void useHistoryStore.getState().undo()} title="Undo (⌘Z)" type="button"><UndoIcon size={16} /></button>
              <button className="icon-button" disabled={!redoStack.length} onClick={() => void useHistoryStore.getState().redo()} title="Redo (⌘⇧Z)" type="button"><RedoIcon size={16} /></button>
            </div>
            <button aria-label="toggle theme" className="icon-button" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Paper' : 'Switch to Graphite'} type="button">{theme === 'dark' ? <SunIcon size={17} /> : <MoonIcon size={17} />}</button>
            <ProfileMenu onLogout={() => void logout()} user={user} />
          </div>
        </div>
      </header>

      <WorkspacePage workspace={workspace} />
      {commandOpen ? <CommandPalette defaultDate={commandDate} onOpenChange={setCommandOpen} open workspace={workspace} /> : null}
    </div>
  );
}

function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const undoStack = useHistoryStore((state) => state.undoStack);
  const redoStack = useHistoryStore((state) => state.redoStack);

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
      <button aria-label="account" aria-expanded={open} className="account-button" onClick={() => setOpen((value) => !value)} type="button">
        {user.username.slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div className="popover-panel modal-in absolute right-0 top-full z-50 mt-3 w-60 overflow-hidden">
          <div className="border-b border-border px-4 py-4">
            <p className="eyebrow mb-2">Your workspace</p>
            <p className="truncate text-sm font-medium">{user.username}</p>
          </div>
          <div className="flex border-b border-border px-3 py-2 md:hidden">
            <button className="secondary-button flex-1 border-0" disabled={!undoStack.length} onClick={() => void useHistoryStore.getState().undo()} type="button"><UndoIcon size={14} />Undo</button>
            <button className="secondary-button flex-1 border-0" disabled={!redoStack.length} onClick={() => void useHistoryStore.getState().redo()} type="button"><RedoIcon size={14} />Redo</button>
          </div>
          <a className="flex min-h-11 items-center px-4 text-xs text-text-secondary hover:bg-surface" href="/brand">The Float brand kit <span className="ml-auto">↗</span></a>
          <button className="flex min-h-11 w-full items-center px-4 text-left text-xs text-text-secondary hover:bg-surface hover:text-danger" onClick={onLogout} type="button">Sign out <span className="ml-auto">↗</span></button>
        </div>
      ) : null}
    </div>
  );
}
