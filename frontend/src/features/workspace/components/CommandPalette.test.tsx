import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/features/workspace/components/CommandPalette';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';

afterEach(cleanup);

function workspaceFixture(): WorkspaceModel {
  return {
    projects: [
      {
        id: 'p1',
        user_id: 'u1',
        title: 'Personal',
        description: null,
        color: '#6366f1',
        icon: null,
        parent_id: null,
        is_archived: false,
        position: 0,
      },
    ],
    tasks: [],
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    reorderProjects: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    moveTask: vi.fn(),
    deleteTask: vi.fn(),
    reorderTasks: vi.fn(),
    refreshProjects: vi.fn(),
    refreshTasks: vi.fn(),
  } as unknown as WorkspaceModel;
}

describe('CommandPalette', () => {
  it('keeps the keyboard-first create flow editable without submitting', async () => {
    const user = userEvent.setup();
    const workspace = workspaceFixture();
    const onOpenChange = vi.fn();
    render(<CommandPalette onOpenChange={onOpenChange} open workspace={workspace} />);

    const search = await screen.findByRole('textbox', { name: 'search or create a task...' });
    await user.type(search, 'Prepare launch @dem');
    await user.keyboard('{Tab}');
    expect(search).toHaveValue('Prepare launch @demain ');

    await user.keyboard('{Tab}');
    const project = screen.getByRole('textbox', { name: 'project' });
    expect(project).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^create/i })).not.toBeInTheDocument();

    await user.keyboard('{Tab}');
    const title = screen.getByRole('textbox', { name: 'new task' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Personal' })).toBeInTheDocument();

    await user.type(title, ' with notes');
    expect(title).toHaveValue('Prepare launch @demain with notes');
    expect(workspace.createTask).not.toHaveBeenCalled();
  });

  it('backs out one level at a time with Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CommandPalette onOpenChange={onOpenChange} open workspace={workspaceFixture()} />);

    const search = await screen.findByRole('textbox', { name: 'search or create a task...' });
    await user.type(search, 'Draft brief');
    await user.keyboard('{Tab}');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'search or create a task...' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
