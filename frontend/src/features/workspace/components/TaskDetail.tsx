import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ChevronDownIcon, CloseIcon, PaperclipIcon, TrashIcon } from '@/components/icons';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { api, type UpdateTaskInput } from '@/lib/api/client';
import type { Task } from '@/types/api';
import { attachmentsQueryOptions, workspaceKeys } from '@/features/workspace/api/queries';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';
import { useTaskDetailQueue } from '@/features/workspace/hooks/use-task-detail-queue';
import { DatePicker } from '@/features/workspace/components/DatePicker';
import { NoteEditor, type NoteEditorHandle } from '@/features/workspace/components/NoteEditor';
import { TaskProjectPicker } from '@/features/workspace/components/TaskProjectPicker';
import './task-detail.css';

interface TaskDetailProps {
  taskId: string;
  workspace: WorkspaceModel;
  onClose: () => void;
}

export function TaskDetail({ taskId, workspace, onClose }: TaskDetailProps) {
  const dialogRef = useDialogFocus();
  const queryClient = useQueryClient();
  const enqueue = useTaskDetailQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<NoteEditorHandle>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const closePendingRef = useRef(false);
  const titlePendingRef = useRef(false);
  const uploadPendingRef = useRef(false);
  const statusPendingRef = useRef(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const task = workspace.tasks.find((candidate) => candidate.id === taskId) ?? deletingTask;
  const projectId = task?.project_id ?? '';
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [removingAttachment, setRemovingAttachment] = useState<string | null>(null);
  const [attachmentDeleting, setAttachmentDeleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(false);
  const attachments = useQuery({
    ...attachmentsQueryOptions(projectId, taskId),
    enabled: Boolean(projectId && taskId),
  });

  const currentProjectId = useCallback(() => queryClient.getQueryData<Task[]>(workspaceKeys.tasks)?.find((candidate) => candidate.id === taskId)?.project_id ?? projectId, [projectId, queryClient, taskId]);
  const update = useCallback((data: UpdateTaskInput) => enqueue(() => workspace.updateTask(currentProjectId(), taskId, data)), [currentProjectId, enqueue, taskId, workspace]);

  const cancelTitle = useCallback(() => {
    if (titlePendingRef.current) return;
    setEditingTitle(false);
    setTitleError('');
    requestAnimationFrame(() => renameRef.current?.focus());
  }, []);

  const requestClose = useCallback(async () => {
    if (closePendingRef.current || titlePendingRef.current || uploadPendingRef.current || deletingTask || attachmentDeleting) return;
    if (editingTitle && title.trim() !== task?.title) {
      setTitleError('Save or cancel your title before closing.');
      titleInputRef.current?.focus();
      return;
    }
    closePendingRef.current = true;
    setClosing(true);
    const saved = await noteRef.current?.save() ?? true;
    closePendingRef.current = false;
    setClosing(false);
    if (saved) onClose();
    else setCloseError(true);
  }, [attachmentDeleting, deletingTask, editingTitle, onClose, task?.title, title]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[data-floating-overlay="true"]')) return;
      // Command/date dialogs may be mounted above this sheet.
      const externalDialog = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some((dialog) => dialog !== dialogRef.current && !dialogRef.current?.contains(dialog));
      if (externalDialog) return;
      event.preventDefault();
      if (projectPickerOpen) { setProjectPickerOpen(false); projectTriggerRef.current?.focus(); return; }
      if (editingTitle) { cancelTitle(); return; }
      if (removingAttachment) { if (!attachmentDeleting) setRemovingAttachment(null); return; }
      if (confirmingDelete) { if (!deletingTask) setConfirmingDelete(false); return; }
      if (closeError) { setCloseError(false); return; }
      void requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attachmentDeleting, cancelTitle, closeError, confirmingDelete, deletingTask, dialogRef, editingTitle, projectPickerOpen, removingAttachment, requestClose]);

  useEffect(() => {
    if (!editingTitle) return;
    const input = titleInputRef.current;
    if (input) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; }
  }, [editingTitle, title]);

  if (!task) return null;

  const currentProject = workspace.projects.find((project) => project.id === projectId);
  const parentProject = workspace.projects.find((project) => project.id === currentProject?.parent_id);
  const busy = closing || uploading || Boolean(deletingTask) || attachmentDeleting;

  const startRenaming = () => {
    setTitle(task.title);
    setTitleError('');
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!editingTitle || titlePendingRef.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) { setTitleError('Give this task a title.'); return; }
    if (nextTitle === task.title) { cancelTitle(); return; }
    titlePendingRef.current = true;
    setTitleSaving(true);
    setTitleError('');
    try {
      await update({ title: nextTitle });
      setEditingTitle(false);
      requestAnimationFrame(() => renameRef.current?.focus());
    } catch {
      setTitleError('Could not save the title. Your edit is still here.');
    } finally {
      titlePendingRef.current = false;
      setTitleSaving(false);
    }
  };

  const toggleDone = async () => {
    if (statusPendingRef.current || deletingTask) return;
    statusPendingRef.current = true;
    setStatusSaving(true);
    setStatusError('');
    try { await update({ is_done: !task.is_done }); }
    catch { setStatusError('Could not update status. Try again.'); }
    finally { statusPendingRef.current = false; setStatusSaving(false); }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files.length || uploadPendingRef.current || deletingTask) return;
    uploadPendingRef.current = true;
    setUploading(true);
    setAttachmentError('');
    setFailedFiles([]);
    const pending = Array.from(files);
    const failed: File[] = [];
    try {
      await enqueue(async () => {
        for (const [index, file] of pending.entries()) {
          setUploadLabel(`Uploading ${index + 1} of ${pending.length}…`);
          try { await api.uploadAttachment(currentProjectId(), taskId, file); }
          catch { failed.push(file); }
        }
        await queryClient.invalidateQueries({ queryKey: workspaceKeys.attachments(currentProjectId(), taskId) });
      });
      if (failed.length) {
        setFailedFiles(failed);
        setAttachmentError(`${failed.length === 1 ? 'A file could' : `${failed.length} files could`} not be uploaded. You can retry.`);
      }
    } finally {
      uploadPendingRef.current = false;
      setUploading(false);
      setUploadLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadAttachment = async (name: string) => {
    if (downloading) return;
    setDownloading(name);
    setAttachmentError('');
    try {
      const blob = await api.downloadAttachment(currentProjectId(), taskId, name);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setAttachmentError('Could not download this file. Select it to try again.');
    } finally { setDownloading(null); }
  };

  const deleteAttachment = async () => {
    if (!removingAttachment || attachmentDeleting) return;
    setAttachmentDeleting(true);
    setAttachmentError('');
    try {
      await enqueue(async () => {
        await api.deleteAttachment(currentProjectId(), taskId, removingAttachment);
        await queryClient.invalidateQueries({ queryKey: workspaceKeys.attachments(currentProjectId(), taskId) });
      });
      setRemovingAttachment(null);
    } catch { setAttachmentError('Could not remove the attachment. Your file is still here.'); }
    finally { setAttachmentDeleting(false); }
  };

  const deleteTask = async () => {
    if (deletingTask || uploadPendingRef.current) return;
    setDeleteError('');
    setDeletingTask(task);
    // Keep the editor mounted throughout optimistic deletion and rollback.
    // Flush first so an earlier pending autosave cannot recreate the deleted task.
    const saved = await noteRef.current?.save() ?? true;
    if (!saved) { setDeletingTask(null); setDeleteError('Save your notes or retry before deleting this task.'); return; }
    try {
      await enqueue(() => workspace.deleteTask(currentProjectId(), taskId));
      onClose();
    } catch { setDeletingTask(null); setDeleteError('Could not delete this task. Nothing was removed. Try again.'); }
  };

  return (
    <div className="detail-overlay">
      <button aria-label="close task" className="fade-in overlay-backdrop" onClick={() => void requestClose()} tabIndex={-1} type="button" />
      <section
        ref={dialogRef}
        aria-label="task details"
        aria-modal="true"
        className={`task-detail task-detail-sheet dialog-surface modal-in ${dragging ? 'is-file-drop' : ''}`}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = uploading ? 'none' : 'copy'; } }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files); }}
        role="dialog"
        tabIndex={-1}
      >
        <div className="detail-topbar">
          <span className="eyebrow"><span aria-hidden="true" className="detail-square" /> Task detail</span>
          <button aria-label="close" className="icon-button" disabled={busy || titleSaving} onClick={() => void requestClose()} title="Close task" type="button"><CloseIcon size={18} /></button>
        </div>

        <div className="task-detail-body detail-sheet-body scrollbar-thin" inert={Boolean(deletingTask) || closing}>
          <header className="detail-heading">
            <div aria-busy={statusSaving} className="detail-status">
              <TaskCheckbox checked={task.is_done} onClick={() => void toggleDone()} />
              <span>{statusSaving ? 'Updating…' : task.is_done ? 'Completed' : 'To do'}</span>
              {!editingTitle ? <button ref={renameRef} aria-label="Rename task" className="detail-text-button detail-rename" onClick={startRenaming} type="button">Rename <span aria-hidden="true">↗</span></button> : null}
            </div>
            {statusError ? <p className="detail-error" role="alert">{statusError}</p> : null}
            {editingTitle ? (
              <div className="detail-title-edit">
                <textarea
                  ref={titleInputRef}
                  aria-describedby={titleError ? 'task-title-error' : 'task-title-help'}
                  aria-invalid={Boolean(titleError)}
                  aria-label="Task title"
                  autoFocus
                  className="task-detail-title detail-title-input"
                  disabled={titleSaving}
                  onChange={(event) => { setTitle(event.target.value.replace(/\n/g, ' ')); setTitleError(''); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void saveTitle(); }
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelTitle(); }
                  }}
                  rows={1}
                  value={title}
                />
                {titleError ? <p className="detail-error" id="task-title-error" role="alert">{titleError}</p> : <p className="detail-muted" id="task-title-help">Enter to save · Esc to cancel</p>}
                <div className="detail-title-actions">
                  <button className="secondary-button" disabled={titleSaving} onClick={cancelTitle} type="button">Cancel</button>
                  <button className="primary-button" disabled={titleSaving} onClick={() => void saveTitle()} type="button">{titleSaving ? 'Saving title…' : 'Save title'}</button>
                </div>
              </div>
            ) : <h2><button className={`task-detail-title detail-title ${task.is_done ? 'task-done' : ''}`} onClick={startRenaming} type="button">{task.title}</button></h2>}
          </header>

          <div className="detail-metadata">
            <div className="detail-property">
              <span className="eyebrow">Schedule</span>
              <DatePicker value={task.due_date} onChange={async (due_date) => { await update({ due_date }); }} />
            </div>
            <div className="detail-property detail-project-property">
              <span className="eyebrow">Project</span>
              <button ref={projectTriggerRef} aria-expanded={projectPickerOpen} aria-haspopup="dialog" aria-label="Move task to project" className="secondary-button detail-project-trigger" disabled={uploading} onClick={() => setProjectPickerOpen((value) => !value)} title={parentProject ? `${parentProject.title} / ${currentProject?.title}` : currentProject?.title} type="button">
                <span aria-hidden="true" className="detail-project-mark" style={currentProject?.icon ? undefined : { background: currentProject?.color ?? 'var(--color-text-muted)' }}>{currentProject?.icon}</span>
                <span className="detail-project-breadcrumb">{parentProject ? <><span>{parentProject.title}</span><span aria-hidden="true"> / </span></> : null}{currentProject?.title ?? 'Choose project'}</span>
                <ChevronDownIcon size={13} />
              </button>
            </div>
          </div>
          {projectPickerOpen ? <TaskProjectPicker currentProjectId={projectId} onClose={() => { setProjectPickerOpen(false); projectTriggerRef.current?.focus(); }} onMove={async (toProjectId) => { await enqueue(() => workspace.moveTask(currentProjectId(), taskId, toProjectId)); }} projects={workspace.projects} /> : null}

          <section aria-labelledby="task-notes-heading" className="detail-notes-section">
            <div className="detail-section-heading"><h3 className="eyebrow" id="task-notes-heading">Notes & details</h3><span className="detail-muted">Optional, always useful.</span></div>
            <NoteEditor ref={noteRef} content={task.description ?? ''} onSave={async (html) => { await update({ description: html || null }); }} />
          </section>

          <section aria-labelledby="task-files-heading" className={`detail-files-section ${dragging ? 'is-dragging' : ''}`}>
            <div className="detail-section-heading">
              <h3 className="eyebrow" id="task-files-heading">Attachments {attachments.data?.length ? <span className="detail-count">{attachments.data.length.toString().padStart(2, '0')}</span> : null}</h3>
              <input ref={fileInputRef} aria-label="Choose attachments" className="hidden" disabled={uploading} multiple onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} type="file" />
              <button aria-label="Attach files" className="detail-text-button" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button"><PaperclipIcon size={14} />Attach files</button>
            </div>
            {uploading ? <p className="detail-transfer-state" role="status"><span className="spinner" />{uploadLabel || 'Preparing files…'}</p> : null}
            {attachments.isPending ? <p className="detail-muted" role="status">Loading attachments…</p> : attachments.isError ? <div className="detail-error" role="alert">Could not load attachments. <button className="detail-text-button" onClick={() => void attachments.refetch()} type="button">Retry attachments</button></div> : attachments.data?.length ? (
              <ul className="detail-file-list">
                {attachments.data.map((attachment) => (
                  <li className="detail-file-row" key={attachment.name}>
                    <span aria-hidden="true" className="detail-file-icon"><PaperclipIcon size={16} /></span>
                    <button className="detail-file-download" disabled={Boolean(downloading)} onClick={() => void downloadAttachment(attachment.name)} title={`Download ${attachment.name}`} type="button"><span>{attachment.name}</span><small>{downloading === attachment.name ? 'Downloading…' : `${formatBytes(attachment.size)} · Download`}</small></button>
                    <button aria-label={`Remove ${attachment.name}`} className="icon-button detail-remove-file" disabled={attachmentDeleting || uploading} onClick={() => { setAttachmentError(''); setRemovingAttachment(attachment.name); }} type="button"><CloseIcon size={15} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="detail-file-empty"><PaperclipIcon size={17} /><span>Keep the useful things close.<small>Attach a file or drop it anywhere on this sheet.</small></span></p>}
            {attachmentError ? <div className="detail-error detail-file-error" role="alert"><p>{attachmentError}</p>{failedFiles.length ? <button className="detail-text-button" disabled={uploading} onClick={() => void uploadFiles(failedFiles)} type="button">Retry upload</button> : null}</div> : null}
            {removingAttachment ? <div aria-label="Remove attachment confirmation" className="detail-confirmation" role="group"><p>Remove <strong>{removingAttachment}</strong> from this task?</p><div className="detail-confirm-actions"><button autoFocus className="secondary-button" disabled={attachmentDeleting} onClick={() => setRemovingAttachment(null)} type="button">Keep attachment</button><button className="secondary-button detail-danger" disabled={attachmentDeleting} onClick={() => void deleteAttachment()} type="button">{attachmentDeleting ? 'Removing…' : 'Remove attachment'}</button></div></div> : null}
          </section>
        </div>

        <footer className="detail-footer">
          {confirmingDelete ? <div aria-label="Delete task confirmation" className="detail-confirmation" role="group"><p>Delete this task and its attachments?<small>This cannot be undone here. Download any files you need first.</small></p>{deleteError ? <p className="detail-error" role="alert">{deleteError}</p> : null}<div className="detail-confirm-actions"><button autoFocus className="secondary-button" disabled={Boolean(deletingTask)} onClick={() => setConfirmingDelete(false)} type="button">Keep task</button><button className="secondary-button detail-danger" disabled={Boolean(deletingTask) || uploading} onClick={() => void deleteTask()} type="button">{deletingTask ? 'Deleting…' : 'Delete permanently'}</button></div></div>
            : closeError ? <div className="detail-confirmation"><p role="alert">Your notes haven’t saved yet.<small>Keep editing or retry. Closing without saving discards this draft.</small></p><div className="detail-confirm-actions"><button className="secondary-button" onClick={() => setCloseError(false)} type="button">Keep editing</button><button className="secondary-button" onClick={() => void requestClose()} type="button">Save & close</button><button className="detail-text-button detail-danger" onClick={onClose} type="button">Discard unsaved notes</button></div></div>
              : <><button className="detail-text-button detail-delete-task" disabled={busy || titleSaving} onClick={() => { setDeleteError(''); setConfirmingDelete(true); }} type="button"><TrashIcon size={13} />Delete task</button><button className="secondary-button detail-finish" disabled={busy || titleSaving} onClick={() => void requestClose()} type="button">{closing ? 'Saving…' : 'Back to my day'}<span aria-hidden="true">↗</span></button></>}
        </footer>
        {dragging ? <div aria-live="polite" className="detail-drop-overlay"><PaperclipIcon size={28} /><p>{uploading ? 'An upload is already in progress' : 'Drop files to attach'}</p></div> : null}
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
