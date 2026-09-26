import { useMemo, useState } from 'react';

import { ChevronRightIcon, PaperclipIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { useUiStore } from '@/stores/ui-store';
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
  const workspaceView = useUiStore((state) => state.workspaceView);
  const setWorkspaceView = useUiStore((state) => state.setWorkspaceView);
  const openTaskComposer = useUiStore((state) => state.openTaskComposer);
  const doneThisSession = useHistoryStore((state) => state.doneThisSession);

  const groups = workspace.projects.filter((project) => !project.parent_id);
  const childrenOf = (projectId: string) => workspace.projects.filter((project) => project.parent_id === projectId);
  const tasksForProject = (projectId: string) => workspace.tasks.filter((task) => task.project_id === projectId);
  const week = useMemo(() => buildWeekData(workspace.projects, workspace.tasks, new Date(), doneThisSession), [workspace.projects, workspace.tasks, doneThisSession]);
  const openCount = workspace.tasks.filter((task) => !task.is_done).length;
  const weekRange = `${week.days[0].date.toLocaleDateString('en', { month: 'long', day: 'numeric' })} — ${week.days[6].date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}`;

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
      <main className="workspace" data-view={workspaceView} id="workspace" tabIndex={-1}>
        <div className="workspace-intro">
          <div><p className="eyebrow">A little less on your mind.</p><h1 className="display-title">Your week<span className="text-brand-orange">.</span></h1></div>
          <div className="intro-meta"><p className="intro-date">{weekRange}</p><button aria-label="New task" className="primary-button" onClick={() => openTaskComposer()} type="button"><PlusIcon size={16} /><span>New task</span></button></div>
        </div>
        <nav aria-label="Workspace views" className="workspace-tabs">
          <button aria-pressed={workspaceView === 'week'} onClick={() => setWorkspaceView('week')} type="button">Week <span>07</span></button>
          <button aria-pressed={workspaceView === 'projects'} onClick={() => setWorkspaceView('projects')} type="button">Projects <span>{String(groups.length).padStart(2, '0')}</span></button>
        </nav>
        <div className="workspace-grid">
        <section aria-label="Weekly agenda" className="week-panel">
          <div className="panel-heading"><h2 className="eyebrow"><span className="section-index">01</span>One day at a time</h2><span className="panel-count">{openCount} open</span></div>
          <WeekView
            hoveredTaskId={hoveredTaskId}
            onHover={setHoveredTaskId}
            onOpenTask={(task) => setSelectedTaskId(task.id)}
            onAddTask={openTaskComposer}
            onReschedule={async (task, dueDate) => { await workspace.updateTask(task.project_id, task.id, { due_date: dueDate }); }}
            onToggleDone={async (task) => { await workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done }); }}
            week={week}
          />
        </section>

        <section aria-label="Projects" className="projects-panel">
          <div className="panel-heading"><h2 className="eyebrow"><span className="section-index">02</span>The bigger picture</h2><span className="panel-count">{groups.length} groups</span></div>
          {!groups.length && addingProjectTo !== 'root' ? <div className="empty-projects"><h3 className="section-title">Room for a fresh start.</h3><p>Create your first group. Work, life, or something just for you.</p></div> : null}
        <div>
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
                  canAddProject
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
                    onStartAdd={() => setAddingTaskTo(group.id)}
                    onCancelAdd={() => setAddingTaskTo(null)}
                    onToggleDone={(task) => workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done })}
                    tasks={tasksForProject(group.id)}
                  />
                ) : (
                  <>
                    {children
                      .sort((a, b) => tasksForProject(b.id).filter((task) => !task.is_done).length - tasksForProject(a.id).filter((task) => !task.is_done).length)
                      .map((child) => {
                        const expanded = isExpanded(child.id);
                        const stats = statsFor(child.id);
                        return (
                          <div className={`border-t transition ${dropTargetId === child.id ? 'border-accent bg-accent/5' : 'border-border'}`} data-drop-project={child.id} key={child.id} onDragLeave={() => setDropTargetId(null)} onDragOver={(event) => { event.preventDefault(); if (dragTask?.project_id !== child.id) setDropTargetId(child.id); }} onDrop={(event) => { event.preventDefault(); void dropTask(child.id); }}>
                            <div className="project-subheader" id={`project-${child.id}`}>
                              <button aria-label={`${expanded ? 'Collapse' : 'Expand'} ${child.title}`} aria-expanded={expanded} className="icon-button" onClick={() => setExpandedOverrides((values) => ({ ...values, [child.id]: !expanded }))} type="button"><ChevronRightIcon className={`transition-transform ${expanded ? 'rotate-90' : ''}`} size={14} /></button>
                              <ColorPicker color={child.color ?? group.color} icon={child.icon} onChange={(color, icon) => workspace.updateProject(child.id, { color, icon })} />
                              {editingProjectId === child.id ? (
                                <input autoFocus className="min-w-0 flex-1 bg-transparent text-xs font-medium text-text outline-none" onBlur={() => void saveProjectTitle(child.id)} onChange={(event) => setEditingProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveProjectTitle(child.id); if (event.key === 'Escape') setEditingProjectId(null); }} value={editingProjectTitle} />
                              ) : (
                                <button className="min-w-0 flex-1 break-words text-left text-sm font-medium text-text-secondary hover:text-text" onClick={() => { setEditingProjectId(child.id); setEditingProjectTitle(child.title); }} title="Rename project" type="button">{child.title}</button>
                              )}
                              {!expanded && stats.total ? <span className="shrink-0 text-[10px] text-text-muted">{stats.done}/{stats.total} ✓</span> : null}
                              <button className="icon-button hover:!text-danger" onClick={() => setConfirmDelete({ id: child.id, title: child.title })} title="delete" type="button"><TrashIcon size={13} /></button>
                            </div>
                            {expanded ? <TaskList adding={addingTaskTo === child.id} addValue={addInputs[child.id] ?? ''} hoveredTaskId={hoveredTaskId} indented onAddValueChange={(value) => setAddInputs((values) => ({ ...values, [child.id]: value }))} onDragEnd={() => { setDragTask(null); setDropTargetId(null); }} onDragStart={setDragTask} onDrop={(detail) => void workspace.moveTask(detail.fromProjectId, detail.taskId, detail.toProjectId)} onHover={setHoveredTaskId} onOpenTask={(task) => setSelectedTaskId(task.id)} onSubmit={(parsed) => addTask(child.id, parsed)} onStartAdd={() => setAddingTaskTo(child.id)} onCancelAdd={() => setAddingTaskTo(null)} onToggleDone={(task) => workspace.updateTask(task.project_id, task.id, { is_done: !task.is_done })} tasks={tasksForProject(child.id)} /> : null}
                          </div>
                        );
                      })}
                  </>
                )}
                {addingProjectTo === group.id ? <InlineProjectInput onCancel={() => setAddingProjectTo(false)} onChange={setNewProjectTitle} onSubmit={() => void addProject(group.id)} placeholder="project name..." value={newProjectTitle} /> : null}
              </section>
            );
          })}

          {addingProjectTo === 'root' ? (
            <div className="workspace-card p-3"><InlineProjectInput onCancel={() => setAddingProjectTo(false)} onChange={setNewProjectTitle} onSubmit={() => void addProject()} placeholder="group name..." value={newProjectTitle} /></div>
          ) : (
            <button aria-label="+ new group" className="new-group" onClick={() => { setAddingProjectTo('root'); setNewProjectTitle(''); }} type="button"><span>New group</span><PlusIcon size={15} /></button>
          )}
        </div>
        </section>
        </div>
        <footer className="workspace-footer"><p className="eyebrow">Less noise. More doing.</p><p className="eyebrow"><kbd>⌘ K</kbd> Find your next thing</p></footer>
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
    <header className="project-header cursor-grab active:cursor-grabbing" draggable id={`project-${project.id}`} onDragEnd={onDragEnd} onDragStart={onDragStart}>
      <ColorPicker color={project.color} icon={project.icon} onChange={onUpdateAppearance} />
      {editing ? <input aria-label="Project name" autoFocus className="project-title bg-transparent" onBlur={onSaveTitle} onChange={(event) => onEditTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} value={editingTitle} /> : <button className="project-title hover:text-text-secondary" onClick={onStartEditing} title="Rename group" type="button">{project.title}</button>}
      <div className="project-actions">
        {canAddProject ? <button onClick={onAddProject} title="add sub-project" type="button"><PlusIcon size={14} /></button> : null}
        {canAddTask ? <button onClick={addingTask} title="add task" type="button"><span className="text-sm">↳</span></button> : null}
        <button className="hover:!text-danger" onClick={onDelete} title="delete" type="button"><TrashIcon size={13} /></button>
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
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onToggleDone: (task: Task) => unknown | Promise<unknown>;
  onOpenTask: (task: Task) => void;
  onDrop: (detail: { taskId: string; fromProjectId: string; toProjectId: string }) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  hoveredTaskId: string | null;
  onHover: (id: string | null) => void;
}

function TaskList({ tasks, adding, addValue, indented, onAddValueChange, onSubmit, onStartAdd, onCancelAdd, onToggleDone, onOpenTask, onDrop, onDragStart, onDragEnd, hoveredTaskId, onHover }: TaskListProps) {
  const doneThisSession = useHistoryStore((state) => state.doneThisSession);
  const pending = tasks.filter((task) => !task.is_done);
  const done = tasks.filter((task) => task.is_done && doneThisSession.has(task.id));
  return (
    <>
      {pending.length ? <div>{pending.map((task) => <TaskRow hovered={hoveredTaskId === task.id} indented={indented} key={task.id} onDragEnd={onDragEnd} onDragStart={onDragStart} onDrop={onDrop} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} task={task} />)}</div> : null}
      {done.length ? <div>{done.map((task) => <TaskRow hovered={hoveredTaskId === task.id} indented={indented} key={task.id} onDragEnd={onDragEnd} onDragStart={onDragStart} onDrop={onDrop} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} task={task} />)}</div> : null}
      {adding ? <div className={`flex items-start gap-3 py-2 ${indented ? 'pl-5' : 'pl-1'}`} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) onCancelAdd(); }}><SmartInput autoFocus inline multiline onBlurSubmit={false} onSubmit={onSubmit} onValueChange={onAddValueChange} placeholder="new task..." value={addValue} showSubmit /><button aria-label="Cancel new task" className="icon-button" onClick={onCancelAdd} type="button">×</button></div> : <button className={`project-add ${indented ? 'ml-5' : ''}`} onClick={onStartAdd} type="button"><PlusIcon size={12} />Add a task…</button>}
    </>
  );
}

function TaskRow({ task, indented, hovered, onToggleDone, onOpenTask, onDrop, onDragStart, onDragEnd, onHover }: { task: Task; indented: boolean; hovered: boolean; onToggleDone: (task: Task) => unknown | Promise<unknown>; onOpenTask: (task: Task) => void; onDrop: (detail: { taskId: string; fromProjectId: string; toProjectId: string }) => void; onDragStart: (task: Task) => void; onDragEnd: () => void; onHover: (id: string | null) => void }) {
  const recent = useHistoryStore((state) => state.recentlyAdded.has(task.id));
  const touchRef = useTouchDrag<HTMLDivElement>({ taskId: task.id, projectId: task.project_id, onDrop });
  return (
    <div ref={touchRef} className={`project-task ${indented ? 'is-indented' : ''} ${recent ? 'task-appear' : ''} ${hovered ? 'is-hovered' : ''}`} draggable onDragEnd={onDragEnd} onDragStart={(event) => { event.dataTransfer.setData('text/task-id', task.id); event.dataTransfer.setData('text/project-id', task.project_id); onDragStart(task); }} onMouseEnter={() => onHover(task.id)} onMouseLeave={() => onHover(null)}>
      <TaskCheckbox checked={task.is_done} onClick={() => void onToggleDone(task)} />
      <button className={`project-task-title ${task.is_done ? 'task-done line-through' : ''}`} onClick={() => onOpenTask(task)} type="button">{task.title}</button>
      {task.description ? <PaperclipIcon className="mt-0.5 shrink-0 text-text-muted" size={12} /> : null}
      {task.due_date ? <span className="w-12 shrink-0 text-right text-[10px] text-text-muted">{relativeDate(task.due_date)}</span> : null}
    </div>
  );
}

function InlineProjectInput({ value, placeholder, onChange, onSubmit, onCancel }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <form className="px-1" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><input autoFocus className="w-full bg-transparent px-2 py-1 text-sm font-medium text-text outline-none placeholder:text-text-muted" onBlur={() => !value && onCancel()} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }} placeholder={placeholder} value={value} /></form>;
}
