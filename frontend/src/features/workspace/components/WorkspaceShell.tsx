import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { CloseIcon, MenuIcon, MoonIcon, PlusIcon, SearchIcon, SunIcon, TrashIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CommandPalette } from '@/features/workspace/components/CommandPalette';
import { ColorPicker } from '@/features/workspace/components/ColorPicker';
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
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const commandOpen = useUiStore((state) => state.commandOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState<false | string | 'root'>(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string; hasTasks: boolean } | null>(null);

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
      if (key === 'escape') {
        if (useUiStore.getState().commandOpen) return;
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandOpen, setSidebarOpen]);

  useEffect(() => {
    const locked = sidebarOpen || commandOpen || Boolean(confirmDelete);
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [commandOpen, confirmDelete, sidebarOpen]);

  const parents = workspace.projects.filter((project) => !project.parent_id);
  const childrenOf = (parentId: string) => workspace.projects.filter((project) => project.parent_id === parentId);

  const addProject = async () => {
    if (!newTitle.trim() || adding === false) return;
    const parentId = adding === 'root' ? undefined : adding;
    const project = await workspace.createProject({ title: newTitle.trim(), parent_id: parentId });
    setNewTitle('');
    setAdding(false);
    if (parentId) {
      setCollapsed((current) => {
        const next = new Set(current);
        next.delete(parentId);
        return next;
      });
    }
    window.setTimeout(() => scrollToProject(project.id), 100);
  };

  const scrollToProject = (projectId: string) => {
    setSidebarOpen(false);
    document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const askDelete = (projectId: string) => {
    const project = workspace.projects.find((candidate) => candidate.id === projectId);
    if (!project) return;
    const childIds = workspace.projects.filter((candidate) => candidate.parent_id === projectId).map((candidate) => candidate.id);
    const hasTasks = workspace.tasks.some((task) => task.project_id === projectId || childIds.includes(task.project_id));
    if (hasTasks || childIds.length) setConfirmDelete({ id: projectId, title: project.title, hasTasks });
    else void workspace.deleteProject(projectId);
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="fixed bottom-0 left-0 z-40 flex items-center gap-1 rounded-tr-2xl border-r border-t border-border/70 bg-bg/80 px-2 py-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl safe-bottom">
        <button aria-label="toggle menu" className="icon-button" onClick={() => setSidebarOpen(!sidebarOpen)} type="button"><MenuIcon size={14} /></button>
        <button aria-label="search" className="icon-button" onClick={() => setCommandOpen(true)} type="button"><SearchIcon size={14} /></button>
      </header>

      {sidebarOpen ? <button aria-label="close menu" className="fade-in fixed inset-0 z-40 bg-black/55 backdrop-blur-[3px]" onClick={() => setSidebarOpen(false)} type="button" /> : null}
      <aside aria-hidden={!sidebarOpen} aria-label="workspace navigation" className={`fixed inset-y-0 left-0 z-50 flex w-72 select-none flex-col border-r border-border bg-elevated/95 shadow-2xl backdrop-blur-xl transition-transform duration-200 safe-bottom safe-top ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} inert={!sidebarOpen}>
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">float</span>
          <button aria-label="close menu" className="icon-button" onClick={() => setSidebarOpen(false)} type="button"><CloseIcon size={14} /></button>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
          <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-text-secondary hover:bg-surface/70 hover:text-text" onClick={() => { setCommandOpen(true); setSidebarOpen(false); }} type="button">
            <SearchIcon size={14} />
            <span className="flex-1 text-left">search</span>
            <kbd className="hidden rounded border border-border bg-surface px-1 py-0.5 font-mono text-[9px] text-text-muted md:inline">⌘K</kbd>
          </button>

          <div className="h-1" />
          {parents.map((group) => {
            const children = childrenOf(group.id);
            const hasChildren = children.length > 0;
            const hidden = collapsed.has(group.id);
            return (
              <div key={group.id}>
                <div className="group mt-3 flex items-center first:mt-0">
                  <div className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1 ${hasChildren ? '' : 'rounded-lg hover:bg-surface/60'}`}>
                    <ColorPicker color={group.color} icon={group.icon} onChange={(color, icon) => workspace.updateProject(group.id, { color, icon })} />
                    {hasChildren ? (
                      <button className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted" onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })} type="button">{group.title}</button>
                    ) : (
                      <button className="min-w-0 flex-1 truncate text-left text-[13px] text-text-muted hover:text-text-secondary" onClick={() => scrollToProject(group.id)} type="button">{group.title}</button>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-text" onClick={() => { setAdding(group.id); setNewTitle(''); }} title="add project" type="button"><PlusIcon size={10} /></button>
                    <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-danger" onClick={() => askDelete(group.id)} title="delete" type="button"><TrashIcon size={10} /></button>
                  </div>
                </div>

                {!hidden ? children.map((child) => (
                  <div className="group relative flex items-center pl-4" key={child.id}>
                    <span className="absolute bottom-0 left-[9px] top-0 w-px bg-border" />
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface/60">
                      <ColorPicker color={child.color ?? group.color} icon={child.icon} onChange={(color, icon) => workspace.updateProject(child.id, { color, icon })} />
                      <button className="min-w-0 flex-1 truncate text-left text-[13px] text-text-muted hover:text-text-secondary" onClick={() => scrollToProject(child.id)} type="button">{child.title}</button>
                    </div>
                    <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-danger opacity-100 md:opacity-0 md:group-hover:opacity-100" onClick={() => askDelete(child.id)} title="delete" type="button"><TrashIcon size={9} /></button>
                  </div>
                )) : null}

                {adding === group.id ? <SidebarInput onCancel={() => setAdding(false)} onChange={setNewTitle} onSubmit={() => void addProject()} placeholder="project name" value={newTitle} /> : null}
              </div>
            );
          })}

          {adding === 'root' ? (
            <SidebarInput onCancel={() => setAdding(false)} onChange={setNewTitle} onSubmit={() => void addProject()} placeholder="group name" value={newTitle} />
          ) : adding === false ? (
            <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-text-muted hover:bg-surface/60 hover:text-text-secondary" onClick={() => { setAdding('root'); setNewTitle(''); }} type="button"><PlusIcon size={12} />new group</button>
          ) : null}
        </nav>

        <footer className="flex items-center justify-between border-t border-border p-2">
          <button className="group flex min-w-0 items-center gap-2" onClick={() => profileOpen ? void logout() : setProfileOpen(true)} type="button">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg transition-transform group-hover:scale-105">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className={`truncate text-xs ${profileOpen ? 'text-danger' : 'text-text-muted group-hover:text-text-secondary'}`}>{profileOpen ? 'sign out' : user.username}</span>
          </button>
          <button aria-label="toggle theme" className="icon-button" onClick={toggleTheme} type="button">{theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}</button>
        </footer>
      </aside>

      <WorkspacePage workspace={workspace} />
      {commandOpen ? <CommandPalette onOpenChange={setCommandOpen} open workspace={workspace} /> : null}
      {confirmDelete ? <ConfirmDialog message={confirmDelete.hasTasks ? 'this contains tasks that will be permanently deleted.' : 'this will be permanently deleted.'} onCancel={() => setConfirmDelete(null)} onConfirm={async () => { await workspace.deleteProject(confirmDelete.id); setConfirmDelete(null); }} title={`delete “${confirmDelete.title}”?`} /> : null}
    </div>
  );
}

function SidebarInput({ value, placeholder, onChange, onSubmit, onCancel }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return (
    <form className="px-2 py-1" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <input autoFocus className="field !rounded-lg !px-2 !py-1 !text-[13px]" onBlur={() => !value && onCancel()} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }} placeholder={placeholder} value={value} />
    </form>
  );
}
