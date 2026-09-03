import { useEffect, useMemo, useRef, useState } from 'react';

import { CheckIcon, ChevronRightIcon, PlusIcon, SearchIcon } from '@/components/icons';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';
import { getSuggestions, parseInput, type Suggestion } from '@/features/workspace/utils/smart-input';
import type { Project } from '@/types/api';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceModel;
}

interface Result {
  type: 'project' | 'task' | 'create';
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  isDone?: boolean;
}

export function CommandPalette({ open, onOpenChange, workspace }: CommandPaletteProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [atSuggestions, setAtSuggestions] = useState<Suggestion[]>([]);
  const [atSelectedIndex, setAtSelectedIndex] = useState(0);
  const [showAtSuggestions, setShowAtSuggestions] = useState(false);
  const [atSource, setAtSource] = useState<'search' | 'create'>('search');
  const [creatingTask, setCreatingTask] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectIndex, setProjectIndex] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const results = useMemo(
    () => buildResults(query, workspace.projects, workspace.tasks),
    [query, workspace.projects, workspace.tasks],
  );
  const projectResults = results.filter((result) => result.type === 'project');
  const taskResults = results.filter((result) => result.type === 'task');
  const leafProjects = useMemo(() => {
    const parents = new Set(workspace.projects.filter((project) => project.parent_id).map((project) => project.parent_id));
    return workspace.projects
      .filter((project) => !parents.has(project.id))
      .filter((project) => !projectQuery.trim() || matches(project.title, projectQuery));
  }, [projectQuery, workspace.projects]);
  const visibleProjects = projectQuery.trim() ? leafProjects.slice(0, 12) : leafProjects.slice(0, 7);
  const selectedProject = selectedProjectId
    ? workspace.projects.find((project) => project.id === selectedProjectId)
    : undefined;

  useEffect(() => {
    window.setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const closeWhenFocusFallsOutside = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onOpenChange(false);
    };
    window.addEventListener('keydown', closeWhenFocusFallsOutside);
    return () => window.removeEventListener('keydown', closeWhenFocusFallsOutside);
  }, [onOpenChange]);

  const updateAtSuggestions = (text: string, source: 'search' | 'create') => {
    const lastWord = text.split(/\s/).at(-1) ?? '';
    if (!lastWord.startsWith('@') || lastWord.length <= 1) {
      setShowAtSuggestions(false);
      return;
    }
    const suggestions = getSuggestions(lastWord.slice(1), []);
    setAtSource(source);
    setAtSuggestions(suggestions);
    setAtSelectedIndex(0);
    setShowAtSuggestions(suggestions.length > 0);
  };

  const applyAtSuggestion = (suggestion: Suggestion) => {
    const sourceText = atSource === 'create' ? creatingTask : query;
    const words = sourceText.split(/\s/);
    words[words.length - 1] = `@${suggestion.value}`;
    const nextValue = `${words.join(' ')} `;
    if (atSource === 'create') setCreatingTask(nextValue);
    else setQuery(nextValue);
    setShowAtSuggestions(false);
    window.setTimeout(() => (atSource === 'create' ? taskInputRef : searchInputRef).current?.focus(), 0);
  };

  const focusProjectInput = () => {
    setProjectPickerOpen(true);
    requestAnimationFrame(() => projectInputRef.current?.focus());
    window.setTimeout(() => projectInputRef.current?.focus(), 20);
  };

  const startCreate = () => {
    if (!query.trim()) return;
    setCreatingTask(query.trim());
    setProjectQuery('');
    setSelectedProjectId(null);
    setProjectPickerOpen(true);
    setProjectIndex(0);
    window.setTimeout(() => projectInputRef.current?.focus(), 0);
  };

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setProjectQuery('');
    setProjectPickerOpen(false);
    setProjectIndex(Math.max(leafProjects.findIndex((project) => project.id === projectId), 0));
    requestAnimationFrame(() => taskInputRef.current?.focus());
    window.setTimeout(() => taskInputRef.current?.focus(), 20);
  };

  const submitCreatedTask = async () => {
    const title = creatingTask.trim();
    if (!title) {
      taskInputRef.current?.focus();
      return;
    }
    if (!selectedProjectId) {
      focusProjectInput();
      return;
    }
    const parsed = parseInput(creatingTask);
    const projectId = selectedProjectId;
    await workspace.createTask(projectId, { title: parsed.title || title, due_date: parsed.due_date });
    onOpenChange(false);
    window.setTimeout(() => document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  };

  const activate = (result: Result) => {
    if (result.type === 'create') {
      startCreate();
      return;
    }
    onOpenChange(false);
    const projectId = result.type === 'project' ? result.id : result.projectId;
    window.setTimeout(() => document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (showAtSuggestions) {
        setShowAtSuggestions(false);
      } else if (creatingTask && projectPickerOpen && selectedProjectId) {
        setProjectPickerOpen(false);
        setProjectQuery('');
        window.setTimeout(() => taskInputRef.current?.focus(), 0);
      } else if (creatingTask) {
        setCreatingTask('');
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        onOpenChange(false);
      }
      return;
    }

    if (showAtSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setAtSelectedIndex((index) => Math.min(index + 1, atSuggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setAtSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if ((event.key === 'Tab' || event.key === 'Enter') && atSuggestions[atSelectedIndex]) {
        event.preventDefault();
        applyAtSuggestion(atSuggestions[atSelectedIndex]);
        return;
      }
    }

    if (creatingTask) {
      const isTaskInput = event.target === taskInputRef.current;
      const isProjectInput = event.target === projectInputRef.current;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setProjectPickerOpen(true);
        setProjectIndex((index) => Math.min(index + 1, Math.max(visibleProjects.length - 1, 0)));
        if (!isProjectInput) projectInputRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setProjectPickerOpen(true);
        setProjectIndex((index) => Math.max(index - 1, 0));
        if (!isProjectInput) projectInputRef.current?.focus();
        return;
      }
      if (projectPickerOpen && (event.key === 'Tab' || event.key === 'Enter') && visibleProjects[projectIndex]) {
        event.preventDefault();
        selectProject(visibleProjects[projectIndex].id);
        return;
      }
      if (isTaskInput && event.key === 'Enter') {
        event.preventDefault();
        if (selectedProjectId) void submitCreatedTask();
        else focusProjectInput();
        return;
      }
      if (isTaskInput && event.key === 'Tab' && !event.shiftKey && !selectedProjectId) {
        event.preventDefault();
        focusProjectInput();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (results[selectedIndex]) activate(results[selectedIndex]);
      else if (query.trim()) startCreate();
    }
  };

  if (!open) return null;
  const parsedPreview = parseInput(creatingTask);
  const createFirst = results[0]?.type === 'create';

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh] md:pt-[15vh]" onKeyDown={onKeyDown}>
      <button aria-label="close command palette" className="fade-in absolute inset-0 bg-black/55 backdrop-blur-[4px]" onClick={() => onOpenChange(false)} type="button" />
      <section aria-label="command palette" aria-modal="true" className="modal-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-elevated/95 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl" role="dialog">
        {creatingTask ? (
          <>
            <div className="border-b border-border/70 px-4 pb-3 pt-4">
              <div className="flex items-center gap-2">
                <input
                  ref={taskInputRef}
                  aria-label="new task"
                  className="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-text outline-none placeholder:text-text-muted/60"
                  onChange={(event) => {
                    setCreatingTask(event.target.value);
                    updateAtSuggestions(event.target.value, 'create');
                  }}
                  placeholder="new task..."
                  value={creatingTask}
                />
                {parsedPreview.due_date ? <DateChip value={parsedPreview.due_date} /> : null}
              </div>
              {showAtSuggestions && atSource === 'create' ? <SuggestionList items={atSuggestions} selectedIndex={atSelectedIndex} onSelect={applyAtSuggestion} /> : null}
              <div className="mt-3 flex items-center gap-2">
                <button className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface/70 px-2 py-1 text-xs text-text-secondary hover:bg-surface hover:text-text" onClick={focusProjectInput} type="button">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: selectedProject?.color ?? '#777d72' }} />
                  <span className="max-w-[220px] truncate">{selectedProject?.title ?? 'project'}</span>
                </button>
              </div>
            </div>

            {projectPickerOpen || !selectedProjectId ? (
              <div className="border-b border-border/70">
                <div className="px-4 py-2">
                  <input
                    ref={projectInputRef}
                    aria-label="project"
                    className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted/60"
                    onChange={(event) => {
                      setProjectQuery(event.target.value);
                      setProjectIndex(0);
                      setProjectPickerOpen(true);
                    }}
                    placeholder={selectedProject ? 'change project...' : 'project...'}
                    value={projectQuery}
                  />
                </div>
                <div className="scrollbar-thin max-h-[34vh] overflow-y-auto pb-1">
                  {visibleProjects.map((project, index) => (
                    <button className="block w-full px-3 py-0.5 text-left" key={project.id} onClick={() => selectProject(project.id)} type="button">
                      <span className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${index === projectIndex ? 'bg-surface text-text' : selectedProjectId === project.id ? 'bg-surface/60 text-text' : 'text-text-secondary hover:bg-surface/50'}`}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.color ?? '#525252' }} />
                        <span className="truncate">{project.title}</span>
                        <span className="ml-auto flex min-w-0 items-center gap-2">
                          {parentName(project, workspace.projects) ? <span className="max-w-[110px] truncate text-[10px] text-text-muted">{parentName(project, workspace.projects)}</span> : null}
                          {selectedProjectId === project.id ? <CheckIcon className="shrink-0 text-text" size={12} /> : null}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!visibleProjects.length ? <p className="px-4 py-5 text-center text-sm text-text-muted">no match</p> : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <SearchIcon className="shrink-0 text-text-muted" size={16} />
              <input
                ref={searchInputRef}
                aria-label="search or create a task..."
                className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted/60"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                  updateAtSuggestions(event.target.value, 'search');
                }}
                placeholder="search or create a task..."
                value={query}
              />
              <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted md:inline">esc</kbd>
            </div>
            {showAtSuggestions ? <div className="border-b border-border"><SuggestionList items={atSuggestions} selectedIndex={atSelectedIndex} onSelect={applyAtSuggestion} /></div> : null}

            <div className="scrollbar-thin max-h-[50vh] overflow-y-auto">
              {query.trim() && results.length ? (
                <>
                  {createFirst ? <CreateResult active={selectedIndex === 0} query={query} onClick={startCreate} prominent /> : null}
                  {projectResults.length ? <ResultGroup label="projects">{projectResults.map((result) => <ResultButton active={results.indexOf(result) === selectedIndex} key={result.id} onClick={() => activate(result)}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: workspace.projects.find((project) => project.id === result.id)?.color ?? '#525252' }} /><span className="truncate text-sm">{result.title}</span><ChevronRightIcon className="ml-auto shrink-0 text-text-muted" size={12} /></ResultButton>)}</ResultGroup> : null}
                  {taskResults.length ? <ResultGroup label="tasks">{taskResults.map((result) => <ResultButton active={results.indexOf(result) === selectedIndex} key={result.id} onClick={() => activate(result)}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" /><span className={`truncate text-sm ${result.isDone ? 'line-through opacity-50' : ''}`}>{result.title}</span>{result.projectName ? <span className="ml-auto max-w-[120px] shrink-0 truncate text-[10px] text-text-muted">{result.projectName}</span> : null}</ResultButton>)}</ResultGroup> : null}
                  {!createFirst ? <CreateResult active={results.findIndex((result) => result.type === 'create') === selectedIndex} query={query} onClick={startCreate} /> : null}
                  <div className="h-1" />
                </>
              ) : !query.trim() ? <p className="px-4 py-8 text-center text-xs text-text-muted">type to search or create</p> : null}
            </div>
            {results.length ? <footer className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-text-muted md:flex"><span><kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono">↑↓</kbd> navigate</span><span><kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono">↵</kbd> open</span></footer> : null}
          </>
        )}
      </section>
    </div>
  );
}

function buildResults(query: string, projects: Project[], tasks: WorkspaceModel['tasks']): Result[] {
  const value = query.trim();
  if (!value) return [];
  const items: Result[] = [];
  for (const project of projects) {
    if (matches(project.title, value)) items.push({ type: 'project', id: project.id, title: project.title });
  }
  for (const task of tasks) {
    if (matches(task.title, value) || (task.description && matches(task.description, value))) {
      items.push({
        type: 'task',
        id: task.id,
        title: task.title,
        projectId: task.project_id,
        projectName: projects.find((project) => project.id === task.project_id)?.title,
        isDone: task.is_done,
      });
    }
  }
  const searchResults = items.slice(0, 12);
  const create: Result = { type: 'create', id: '__create__', title: value };
  return items.some((item) => item.type === 'project') ? [...searchResults, create] : [create, ...searchResults];
}

function matches(text: string, query: string) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.includes(needle)) return true;
  let needleIndex = 0;
  for (let index = 0; index < haystack.length && needleIndex < needle.length; index += 1) {
    if (haystack[index] === needle[needleIndex]) needleIndex += 1;
  }
  return needleIndex === needle.length;
}

function parentName(project: Project, projects: Project[]) {
  return project.parent_id ? projects.find((candidate) => candidate.id === project.parent_id)?.title ?? null : null;
}

function DateChip({ value }: { value: string }) {
  const date = new Date(value);
  const time = date.getHours() || date.getMinutes() ? ` ${date.getHours()}h${date.getMinutes().toString().padStart(2, '0')}` : '';
  return <span className="shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}{time}</span>;
}

function SuggestionList({ items, selectedIndex, onSelect }: { items: Suggestion[]; selectedIndex: number; onSelect: (suggestion: Suggestion) => void }) {
  return (
    <div className="overflow-hidden bg-elevated">
      {items.map((suggestion, index) => (
        <button className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${index === selectedIndex ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}`} key={`${suggestion.type}-${suggestion.value}`} onMouseDown={(event) => { event.preventDefault(); onSelect(suggestion); }} type="button">
          <span className="w-8 text-right text-[9px] font-medium uppercase tracking-wider text-text-muted">{suggestion.type === 'project' ? 'proj' : suggestion.type}</span>
          <span className="flex-1">{suggestion.label}</span>
          {suggestion.description ? <span className="text-[11px] text-text-muted">{suggestion.description}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</p>{children}</div>;
}

function ResultButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className="block w-full px-3 py-0.5 text-left" onClick={onClick} type="button"><span className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${active ? 'bg-surface text-text' : 'text-text-secondary hover:bg-surface/50'}`}>{children}</span></button>;
}

function CreateResult({ active, query, onClick, prominent = false }: { active: boolean; query: string; onClick: () => void; prominent?: boolean }) {
  return <button className={`block w-full px-3 text-left ${prominent ? 'py-1' : 'mt-1 border-t border-border/50 py-1'}`} onClick={onClick} type="button"><span className={`flex items-center gap-2.5 rounded-lg px-2 ${prominent ? 'py-2.5' : 'py-2'} ${active ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface/50 hover:text-text-secondary'}`}><PlusIcon size={prominent ? 14 : 12} /><span className={prominent ? 'text-sm' : 'text-[13px]'}>create {prominent ? <strong>“{query.trim()}”</strong> : `“${query.trim()}”`}</span></span></button>;
}
