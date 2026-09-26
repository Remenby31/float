import { useState } from 'react';

import { CheckIcon, CloseIcon, SearchIcon } from '@/components/icons';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import type { Project } from '@/types/api';

interface TaskProjectPickerProps {
  projects: Project[];
  currentProjectId: string;
  onMove: (projectId: string) => Promise<void>;
  onClose: () => void;
}

export function TaskProjectPicker({ projects, currentProjectId, onMove, onClose }: TaskProjectPickerProps) {
  const dialogRef = useDialogFocus();
  const [search, setSearch] = useState('');
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const leafProjects = projects.filter((project) => !project.is_archived && !projects.some((child) => child.parent_id === project.id));
  const matches = leafProjects.filter((project) => projectPath(project, projects).toLowerCase().includes(search.trim().toLowerCase()));

  const move = async (id: string) => {
    if (movingTo) return;
    if (id === currentProjectId) { onClose(); return; }
    setMovingTo(id);
    setError(false);
    try {
      await onMove(id);
      onClose();
    } catch {
      setError(true);
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <section
      ref={dialogRef}
      aria-label="Move task"
      aria-modal="true"
      className="detail-project-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!movingTo) onClose(); }
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div className="detail-section-heading">
        <h3 className="eyebrow">Move to a project</h3>
        <button aria-label="close project picker" className="icon-button" disabled={Boolean(movingTo)} onClick={onClose} type="button"><CloseIcon size={14} /></button>
      </div>
      <label className="detail-project-search">
        <SearchIcon size={14} />
        <input aria-label="Search projects" autoFocus disabled={Boolean(movingTo)} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project…" type="text" value={search} />
      </label>
      <div aria-label="Projects" className="detail-project-options scrollbar-thin">
        {matches.length ? matches.map((project) => (
          <button aria-label={projectPath(project, projects)} aria-current={project.id === currentProjectId ? 'true' : undefined} className="detail-project-option" disabled={Boolean(movingTo)} key={project.id} onClick={() => void move(project.id)} type="button">
            <span aria-hidden="true" className="detail-project-mark" style={project.icon ? undefined : { background: project.color ?? 'var(--color-text-muted)' }}>{project.icon}</span>
            <span className="detail-project-name">{projectPath(project, projects)}</span>
            {movingTo === project.id ? <span className="spinner" /> : project.id === currentProjectId ? <CheckIcon size={14} /> : null}
          </button>
        )) : <p className="detail-project-empty">{leafProjects.length ? 'No projects match your search.' : 'No available projects yet.'}</p>}
      </div>
      {error ? <p className="detail-error" role="alert">Could not move this task. Choose a project to try again.</p> : null}
    </section>
  );
}

function projectPath(project: Project, projects: Project[]): string {
  const parts = [project.title];
  const seen = new Set([project.id]);
  let parentId = project.parent_id;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = projects.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    parts.unshift(parent.title);
    parentId = parent.parent_id;
  }
  return parts.join(' / ');
}
