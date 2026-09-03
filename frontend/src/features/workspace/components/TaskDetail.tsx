import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { CheckIcon, CloseIcon, PaperclipIcon, TrashIcon } from '@/components/icons';
import { api } from '@/lib/api/client';
import { toast } from '@/stores/toast-store';
import { attachmentsQueryOptions, workspaceKeys } from '@/features/workspace/api/queries';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';
import { DatePicker } from '@/features/workspace/components/DatePicker';
import { NoteEditor } from '@/features/workspace/components/NoteEditor';

interface TaskDetailProps {
  taskId: string;
  workspace: WorkspaceModel;
  onClose: () => void;
}

export function TaskDetail({ taskId, workspace, onClose }: TaskDetailProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const task = workspace.tasks.find((candidate) => candidate.id === taskId);
  const projectId = task?.project_id ?? '';
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const attachments = useQuery({
    ...attachmentsQueryOptions(projectId, taskId),
    enabled: Boolean(projectId && taskId),
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[data-floating-overlay="true"]')) return;
      if (projectPickerOpen) {
        setProjectPickerOpen(false);
        return;
      }
      if (confirmingDelete) {
        setConfirmingDelete(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmingDelete, onClose, projectPickerOpen]);

  if (!task) return null;

  const leafProjects = workspace.projects.filter((project) => !workspace.projects.some((child) => child.parent_id === project.id));
  const currentProject = workspace.projects.find((project) => project.id === projectId);

  const saveTitle = async () => {
    if (!editingTitle) return;
    setEditingTitle(false);
    const nextTitle = title.trim();
    if (nextTitle && nextTitle !== task.title) await workspace.updateTask(projectId, task.id, { title: nextTitle });
    else setTitle(task.title);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await api.uploadAttachment(projectId, task.id, file);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.attachments(projectId, task.id) });
    } catch {
      toast.error('Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadAttachment = async (name: string) => {
    try {
      const blob = await api.downloadAttachment(projectId, task.id, name);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download attachment');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-stretch md:px-4 md:py-10">
      <button aria-label="close task" className="fade-in absolute inset-0 bg-black/55 backdrop-blur-[4px]" onClick={onClose} type="button" />
      <section
        aria-label="task details"
        aria-modal="true"
        className="modal-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border-t border-border bg-elevated shadow-2xl safe-bottom md:h-full md:max-w-4xl md:rounded-2xl md:border"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files);
        }}
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              aria-label="toggle done"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition hover:scale-110"
              onClick={() => void workspace.updateTask(projectId, task.id, { is_done: !task.is_done })}
              style={{ borderColor: task.is_done ? 'var(--color-success)' : 'var(--color-border-strong)', background: task.is_done ? 'var(--color-success)' : 'transparent' }}
              type="button"
            >
              {task.is_done ? <CheckIcon className="text-white" size={12} /> : null}
            </button>
            {editingTitle ? (
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-lg font-medium leading-snug text-text outline-none"
                onBlur={() => void saveTitle()}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                value={title}
              />
            ) : (
              <button className={`min-w-0 flex-1 truncate text-left text-lg font-medium leading-snug hover:text-text-secondary ${task.is_done ? 'text-text-muted line-through' : 'text-text'}`} onClick={() => { setTitle(task.title); setEditingTitle(true); }} type="button">{task.title}</button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {confirmingDelete ? (
              <>
                <span className="mr-1 text-xs text-danger">delete?</span>
                <button className="rounded-lg bg-danger px-2 py-1 text-xs text-white" onClick={async () => { await workspace.deleteTask(projectId, task.id); onClose(); }} type="button">yes</button>
                <button className="rounded-lg px-2 py-1 text-xs text-text-muted hover:text-text" onClick={() => setConfirmingDelete(false)} type="button">no</button>
              </>
            ) : (
              <button className="icon-button hover:!text-danger" onClick={() => setConfirmingDelete(true)} title="delete" type="button"><TrashIcon size={14} /></button>
            )}
            <button aria-label="close" className="icon-button" onClick={onClose} type="button"><CloseIcon size={14} /></button>
          </div>
        </header>

        <div className="scrollbar-thin flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <p className="w-10 text-[10px] uppercase tracking-wider text-text-muted">due</p>
              <DatePicker value={task.due_date} onChange={async (due_date) => { await workspace.updateTask(projectId, task.id, { due_date }); }} />
            </div>
            <div className="flex items-center gap-3">
              <p className="w-10 text-[10px] uppercase tracking-wider text-text-muted">in</p>
              <div className="relative">
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-surface/50 hover:text-text" onClick={() => setProjectPickerOpen((value) => !value)} type="button">
                  {currentProject?.icon ? <span>{currentProject.icon}</span> : <span className="h-2 w-2 rounded-full" style={{ background: currentProject?.color ?? '#525252' }} />}
                  <span>{currentProject?.title ?? 'unknown'}</span>
                </button>
                {projectPickerOpen ? (
                  <>
                    <button aria-label="close project picker" className="fixed inset-0 z-10" onClick={() => setProjectPickerOpen(false)} type="button" />
                    <div className="scrollbar-thin absolute left-0 top-full z-20 mt-1 max-h-52 w-52 overflow-y-auto rounded-xl border border-border bg-elevated py-1 shadow-xl">
                      {leafProjects.map((project) => (
                        <button className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${project.id === projectId ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/60'}`} key={project.id} onClick={async () => { await workspace.moveTask(projectId, task.id, project.id); setProjectPickerOpen(false); }} type="button">
                          {project.icon ? <span>{project.icon}</span> : <span className="h-2 w-2 rounded-full" style={{ background: project.color ?? '#525252' }} />}
                          <span className="truncate">{project.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[240px] flex-1 flex-col rounded-xl border border-border-subtle bg-bg/25 p-4">
            <NoteEditor content={task.description ?? ''} onSave={async (html) => { await workspace.updateTask(projectId, task.id, { description: html || null }); }} />
            <div className="absolute bottom-2 right-2">
              <input ref={fileInputRef} className="hidden" multiple onChange={(event) => event.target.files && void uploadFiles(event.target.files)} type="file" />
              <button className="icon-button" disabled={uploading} onClick={() => fileInputRef.current?.click()} title="attach file (drop or click)" type="button">
                {uploading ? <span className="spinner" /> : <PaperclipIcon size={14} />}
              </button>
            </div>
          </div>

          {attachments.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {attachments.data.map((attachment) => (
                <div className="group flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-muted" key={attachment.name}>
                  <PaperclipIcon size={10} />
                  <button className="max-w-[180px] truncate hover:text-text" onClick={() => void downloadAttachment(attachment.name)} type="button">{attachment.name}</button>
                  <span className="text-[9px] text-text-muted/70">{formatBytes(attachment.size)}</span>
                  <button aria-label={`delete ${attachment.name}`} className="ml-0.5 grid h-4 w-4 place-items-center opacity-0 hover:text-danger group-hover:opacity-100" onClick={async () => { await api.deleteAttachment(projectId, task.id, attachment.name); await queryClient.invalidateQueries({ queryKey: workspaceKeys.attachments(projectId, task.id) }); }} type="button"><CloseIcon size={8} /></button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
