import { useMemo, useState } from 'react';

import { CheckIcon, ChevronRightIcon, PaperclipIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';
import { useHistoryStore } from '@/features/workspace/stores/history-store';
import { useTouchDrag } from '@/features/workspace/hooks/use-touch-drag';
import { buildWeekData } from '@/features/workspace/utils/week';
import { relativeDate } from '@/features/workspace/utils/dates';
import type { ParsedTask } from '@/features/workspace/utils/smart-input';
import { ColorPicker } from '@/features/workspace/components/ColorPicker';
import { SmartInput } from '@/features/workspace/components/SmartInput';
import { TaskDetail } from '@/features/workspace/components/TaskDetail';
import { WeekView } from '@/features/workspace/components/WeekView';
import type { Project, Task } from '@/types/api';

interface WorkspacePageProps {
  workspace: WorkspaceModel;
}

export function WorkspacePage({ workspace }: WorkspacePageProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addInputs, setAddInputs] = useState<Record<string, string>>({});
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dropProjectTargetId, setDropProjectTargetId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');
  const [addingProjectTo, setAddingProjectTo] = useState<false | string | 'root'>(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [recursiveAppearance, setRecursiveAppearance] = useState<{ parentId: string; icon: string } | null>(null);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const groups = workspace.projects.filter((project) => !project.parent_id);
  const childrenOf = (projectId: string) => workspace.projects.filter((project) => project.parent_id === projectId);
  const tasksForProject = (projectId: string) => workspace.tasks.filter((task) => task.project_id === projectId);
  const week = useMemo(() => buildWeekData(workspace.projects, workspace.tasks), [workspace.projects, workspace.tasks]);
  const hasDatedTasks = week.days.some((day) => day.tasks.length || day.overdueTasks.length) || week.later.length > 0;

  const statsFor = (projectId: string) => {
    const tasks = tasksForProject(projectId);
    return { total: tasks.length, done: tasks.filter((task) => task.is_done).length };
  };
  const isExpanded = (projectId: string) => {
    if (projectId in expandedOverrides) return expandedOverrides[projectId];
    const tasks = tasksForProject(projectId);
    return tasks.length === 0 || tasks.some((task) => !task.is_done);
  };

  const addTask = async (projectId: string, parsed: ParsedTask) => {
    if (!parsed.title) return;
    await workspace.createTask(projectId, { title: parsed.title, due_date: parsed.due_date });
    setAddInputs((values) => ({ ...values, [projectId]: '' }));
    setAddingTaskTo(null);
  };

  const saveProjectTitle = async (projectId: string) => {
    setEditingProjectId(null);
    if (editingProjectTitle.trim()) await workspace.updateProject(projectId, { title: editingProjectTitle.trim() });
  };

  const addProject = async (parentId?: string) => {
    if (!newProjectTitle.trim()) return;
    await workspace.createProject({ title: newProjectTitle.trim(), parent_id: parentId });
    setNewProjectTitle('');
    setAddingProjectTo(false);
  };

  const updateAppearance = async (project: Project, color: string | null, icon: string | null) => {
    await workspace.updateProject(project.id, { color, icon });
    if (childrenOf(project.id).length && icon) setRecursiveAppearance({ parentId: project.id, icon });
  };

  const applyAppearanceToChildren = async () => {
    if (!recursiveAppearance) return;
    for (const child of childrenOf(recursiveAppearance.parentId)) {
      await workspace.updateProject(child.id, { icon: recursiveAppearance.icon });
    }
    setRecursiveAppearance(null);
  };

  const dropTask = async (toProjectId: string) => {
    setDropTargetId(null);
    if (!dragTask || dragTask.project_id === toProjectId) return;
    const task = dragTask;
    setDragTask(null);
    await workspace.moveTask(task.project_id, task.id, toProjectId);
  };

  const dropProject = async (targetId: string) => {
    setDropProjectTargetId(null);
    if (!dragProjectId || dragProjectId === targetId) return;
    const ids = groups.map((project) => project.id);
    const from = ids.indexOf(dragProjectId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragProjectId);
    setDragProjectId(null);
    await workspace.reorderProjects(ids);
  };

  return (
    <>
      <main className="mx-auto max-w-6xl px-3 py-4 md:px-5 md:py-6">
        {hasDatedTasks ? (
          <WeekView
            hoveredTaskId={hoveredTaskId}
            onHover={setHoveredTaskId}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onReschedule={async (task, dueDate) => { await workspace.updateTask(task.project_id, task.id, { due_date: dueDate }); }}
            onToggleDone={async (task) => { await workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done }); }}
            week={week}
          />
        ) : null}

        <div className="columns-1 gap-4 space-y-4 md:columns-2 [contain:layout_style]">
          {groups.map((group) => {
            const children = childrenOf(group.id);
            const projectDropActive = dropProjectTargetId === group.id;
            const taskDropActive = dropTargetId === group.id && children.length === 0;
            return (
              <section
                className={`workspace-card transition ${projectDropActive || taskDropActive ? 'scale-[1.01] !border-accent ring-2 ring-accent/15' : ''} ${dragProjectId === group.id ? 'opacity-40' : ''}`}
                data-drop-project={children.length === 0 ? group.id : undefined}
                key={group.id}
                onDragLeave={() => dragProjectId ? setDropProjectTargetId(null) : setDropTargetId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragProjectId && dragProjectId !== group.id) setDropProjectTargetId(group.id);
                  else if (dragTask && children.length === 0 && dragTask.project_id !== group.id) setDropTargetId(group.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragProjectId) void dropProject(group.id);
                  else if (children.length === 0) void dropTask(group.id);
                }}
              >
                <ProjectHeader
                  addingTask={() => setAddingTaskTo(group.id)}
                  canAddTask={!children.length}
                  canAddProject={Boolean(children.length)}
                  editing={editingProjectId === group.id}
                  editingTitle={editingProjectTitle}
                  onAddProject={() => { setAddingProjectTo(group.id); setNewProjectTitle(''); }}
                  onDelete={() => setConfirmDelete({ id: group.id, title: group.title })}
                  onDragEnd={() => { setDragProjectId(null); setDropProjectTargetId(null); }}
                  onDragStart={() => setDragProjectId(group.id)}
                  onEditTitle={setEditingProjectTitle}
                  onSaveTitle={() => void saveProjectTitle(group.id)}
                  onStartEditing={() => { setEditingProjectId(group.id); setEditingProjectTitle(group.title); }}
                  onUpdateAppearance={(color, icon) => updateAppearance(group, color, icon)}
                  project={group}
                />

                {!children.length ? (
                  <TaskList
                    adding={addingTaskTo === group.id}
                    addValue={addInputs[group.id] ?? ''}
                    indented={false}
                    onAddValueChange={(value) => setAddInputs((values) => ({ ...values, [group.id]: value }))}
                    onDragEnd={() => { setDragTask(null); setDropTargetId(null); }}
                    onDragStart={setDragTask}
                    onDrop={(detail) => void workspace.moveTask(detail.fromProjectId, detail.taskId, detail.toProjectId)}
                    hoveredTaskId={hoveredTaskId}
                    onHover={setHoveredTaskId}
                    onOpenTask={(task) => setSelectedTaskId(task.id)}
                    onSubmit={(parsed) => addTask(group.id, parsed)}
                    onToggleDone={(task) => workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done })}
                    tasks={tasksForProject(group.id)}
                  />
                ) : (
                  <>
                    {children
                      .filter((child) => tasksForProject(child.id).length > 0)
                      .sort((a, b) => tasksForProject(b.id).filter((task) => !task.is_done).length - tasksForProject(a.id).filter((task) => !task.is_done).length)
                      .map((child) => {
                        const expanded = isExpanded(child.id);
                        const stats = statsFor(child.id);
                        return (
                          <div className={`border-t transition ${dropTargetId === child.id ? 'border-accent bg-accent/5' : 'border-border'}`} data-drop-project={child.id} key={child.id} onDragLeave={() => setDropTargetId(null)} onDragOver={(event) => { event.preventDefault(); if (dragTask?.project_id !== child.id) setDropTargetId(child.id); }} onDrop={(event) => { event.preventDefault(); void dropTask(child.id); }}>
                            <div className="group/child flex cursor-pointer select-none items-center gap-2.5 bg-surface/20 py-2 pl-6 pr-4" id={`project-${child.id}`} onClick={(event) => { if (!(event.target as HTMLElement).closest('button,input')) setExpandedOverrides((values) => ({ ...values, [child.id]: !expanded })); }}>
                              <ChevronRightIcon className={`shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} size={10} />
                              <ColorPicker color={child.color ?? group.color} icon={child.icon} onChange={(color, icon) => workspace.updateProject(child.id, { color, icon })} />
                              {editingProjectId === child.id ? (
                                <input autoFocus className="min-w-0 flex-1 bg-transparent text-xs font-medium text-text outline-none" onBlur={() => void saveProjectTitle(child.id)} onChange={(event) => setEditingProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveProjectTitle(child.id); if (event.key === 'Escape') setEditingProjectId(null); }} value={editingProjectTitle} />
                              ) : (
                                <button className="min-w-0 flex-1 truncate text-left text-xs font-medium text-text-secondary hover:text-text" onDoubleClick={(event) => { event.stopPropagation(); setEditingProjectId(child.id); setEditingProjectTitle(child.title); }} type="button">{child.title}</button>
                              )}
                              {!expanded && stats.total ? <span className="shrink-0 text-[10px] text-text-muted">{stats.done}/{stats.total} ✓</span> : null}
                              <button className="grid h-4 w-4 place-items-center rounded text-text-muted hover:text-danger md:opacity-0 md:group-hover/child:opacity-100" onClick={(event) => { event.stopPropagation(); setConfirmDelete({ id: child.id, title: child.title }); }} title="delete" type="button"><TrashIcon size={8} /></button>
                            </div>
                            {expanded ? <TaskList adding={addingTaskTo === child.id} addValue={addInputs[child.id] ?? ''} hoveredTaskId={hoveredTaskId} indented onAddValueChange={(value) => setAddInputs((values) => ({ ...values, [child.id]: value }))} onDragEnd={() => { setDragTask(null); setDropTargetId(null); }} onDragStart={setDragTask} onDrop={(detail) => void workspace.moveTask(detail.fromProjectId, detail.taskId, detail.toProjectId)} onHover={setHoveredTaskId} onOpenTask={(task) => setSelectedTaskId(task.id)} onSubmit={(parsed) => addTask(child.id, parsed)} onToggleDone={(task) => workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done })} tasks={tasksForProject(child.id)} /> : null}
                          </div>
                        );
                      })}
                    {addingProjectTo === group.id ? <InlineProjectInput onCancel={() => setAddingProjectTo(false)} onChange={setNewProjectTitle} onSubmit={() => void addProject(group.id)} placeholder="project name..." value={newProjectTitle} /> : null}
                  </>
                )}
              </section>
            );
          })}

          {addingProjectTo === 'root' ? (
            <div className="workspace-card p-3"><InlineProjectInput onCancel={() => setAddingProjectTo(false)} onChange={setNewProjectTitle} onSubmit={() => void addProject()} placeholder="group name..." value={newProjectTitle} /></div>
          ) : (
            <button className="w-full break-inside-avoid rounded-2xl border border-dashed border-border py-3 text-xs text-text-muted transition hover:border-border-strong hover:bg-surface/20 hover:text-text-secondary" onClick={() => { setAddingProjectTo('root'); setNewProjectTitle(''); }} type="button">+ new group</button>
          )}
        </div>
      </main>

      {confirmDelete ? <ConfirmDialog message="this project and its tasks will be permanently deleted." onCancel={() => setConfirmDelete(null)} onConfirm={async () => { await workspace.deleteProject(confirmDelete.id); setConfirmDelete(null); }} title={`delete “${confirmDelete.title}”?`} /> : null}
      {recursiveAppearance ? <ConfirmDialog confirmLabel="yes, apply" message={`apply ${recursiveAppearance.icon} to all sub-projects in this group?`} onCancel={() => setRecursiveAppearance(null)} onConfirm={applyAppearanceToChildren} title="apply to sub-projects?" /> : null}
      {selectedTaskId ? <TaskDetail key={selectedTaskId} onClose={() => setSelectedTaskId(null)} taskId={selectedTaskId} workspace={workspace} /> : null}
    </>
  );
}

interface ProjectHeaderProps {
  project: Project;
  editing: boolean;
  editingTitle: string;
  canAddTask: boolean;
  canAddProject: boolean;
  addingTask: () => void;
  onAddProject: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStartEditing: () => void;
  onEditTitle: (value: string) => void;
  onSaveTitle: () => void;
  onUpdateAppearance: (color: string | null, icon: string | null) => unknown | Promise<unknown>;
}

function ProjectHeader({ project, editing, editingTitle, canAddTask, canAddProject, addingTask, onAddProject, onDelete, onDragStart, onDragEnd, onStartEditing, onEditTitle, onSaveTitle, onUpdateAppearance }: ProjectHeaderProps) {
  return (
    <header className="group/header flex cursor-grab items-center gap-3 bg-surface/35 px-4 py-3 active:cursor-grabbing" draggable id={`project-${project.id}`} onDragEnd={onDragEnd} onDragStart={onDragStart}>
      <ColorPicker color={project.color} icon={project.icon} onChange={onUpdateAppearance} />
      {editing ? <input autoFocus className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text outline-none" onBlur={onSaveTitle} onChange={(event) => onEditTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSaveTitle(); }} value={editingTitle} /> : <button className="min-w-0 flex-1 truncate text-left text-sm font-medium text-text hover:text-text-secondary" onDoubleClick={onStartEditing} type="button">{project.title}</button>}
      <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover/header:opacity-100">
        {canAddProject ? <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-text" onClick={onAddProject} title="add sub-project" type="button"><PlusIcon size={10} /></button> : null}
        {canAddTask ? <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-text" onClick={addingTask} title="add task" type="button"><PlusIcon size={10} /></button> : null}
        <button className="grid h-5 w-5 place-items-center rounded text-text-muted hover:text-danger" onClick={onDelete} title="delete" type="button"><TrashIcon size={10} /></button>
      </div>
    </header>
  );
}

interface TaskListProps {
  tasks: Task[];
  adding: boolean;
  addValue: string;
  indented: boolean;
  onAddValueChange: (value: string) => void;
  onSubmit: (parsed: ParsedTask) => void | Promise<void>;
  onToggleDone: (task: Task) => unknown | Promise<unknown>;
  onOpenTask: (task: Task) => void;
  onDrop: (detail: { taskId: string; fromProjectId: string; toProjectId: string }) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  hoveredTaskId: string | null;
  onHover: (id: string | null) => void;
}

function TaskList({ tasks, adding, addValue, indented, onAddValueChange, onSubmit, onToggleDone, onOpenTask, onDrop, onDragStart, onDragEnd, hoveredTaskId, onHover }: TaskListProps) {
  const doneThisSession = useHistoryStore((state) => state.doneThisSession);
  const pending = tasks.filter((task) => !task.is_done);
  const done = tasks.filter((task) => task.is_done && doneThisSession.has(task.id));
  return (
    <>
      {pending.length ? <div className="divide-y divide-border/50">{pending.map((task) => <TaskRow hovered={hoveredTaskId === task.id} indented={indented} key={task.id} onDragEnd={onDragEnd} onDragStart={onDragStart} onDrop={onDrop} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} task={task} />)}</div> : null}
      {adding ? <div className={`flex items-center gap-3 px-4 py-1.5 ${indented ? 'pl-6' : ''}`}><span className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-border opacity-50" /><SmartInput autoFocus inline multiline onBlurSubmit={false} onSubmit={onSubmit} onValueChange={onAddValueChange} placeholder="new task..." value={addValue} /></div> : null}
      {done.length ? <div className="divide-y divide-border/50 border-t border-border/30">{done.map((task) => <TaskRow hovered={hoveredTaskId === task.id} indented={indented} key={task.id} onDragEnd={onDragEnd} onDragStart={onDragStart} onDrop={onDrop} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} task={task} />)}</div> : null}
    </>
  );
}

function TaskRow({ task, indented, hovered, onToggleDone, onOpenTask, onDrop, onDragStart, onDragEnd, onHover }: { task: Task; indented: boolean; hovered: boolean; onToggleDone: (task: Task) => unknown | Promise<unknown>; onOpenTask: (task: Task) => void; onDrop: (detail: { taskId: string; fromProjectId: string; toProjectId: string }) => void; onDragStart: (task: Task) => void; onDragEnd: () => void; onHover: (id: string | null) => void }) {
  const recent = useHistoryStore((state) => state.recentlyAdded.has(task.id));
  const touchRef = useTouchDrag<HTMLDivElement>({ taskId: task.id, projectId: task.project_id, onDrop });
  return (
    <div ref={touchRef} className={`group flex cursor-pointer items-start gap-3 px-4 py-1.5 transition hover:bg-surface/35 active:bg-surface/50 ${indented ? 'pl-6' : ''} ${recent ? 'task-appear' : ''} ${hovered ? 'bg-accent/8' : ''}`} draggable onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onOpenTask(task); }} onDragEnd={onDragEnd} onDragStart={(event) => { event.dataTransfer.setData('text/task-id', task.id); event.dataTransfer.setData('text/project-id', task.project_id); onDragStart(task); }} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => onHover(null)}>
      <button aria-label="toggle done" className={`touch-target relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${task.is_done ? 'border-success bg-success' : 'border-border-strong hover:border-success hover:bg-success'}`} onClick={(event) => { event.stopPropagation(); void onToggleDone(task); }} type="button">{task.is_done ? <CheckIcon className="text-white" size={10} /> : null}</button>
      <span className={`min-w-0 flex-1 text-sm leading-5 ${task.is_done ? 'text-text-muted line-through' : 'text-text'}`}>{task.title}</span>
      {task.description ? <PaperclipIcon className="mt-0.5 shrink-0 text-text-muted" size={12} /> : null}
      {task.due_date ? <span className="w-12 shrink-0 text-right text-[10px] text-text-muted">{relativeDate(task.due_date)}</span> : null}
    </div>
  );
}

function InlineProjectInput({ value, placeholder, onChange, onSubmit, onCancel }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <form className="px-1" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><input autoFocus className="w-full bg-transparent px-2 py-1 text-sm font-medium text-text outline-none placeholder:text-text-muted/50" onBlur={() => !value && onCancel()} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }} placeholder={placeholder} value={value} /></form>;
}
