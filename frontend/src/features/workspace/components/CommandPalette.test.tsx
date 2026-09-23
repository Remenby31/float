import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from '@/features/workspace/components/CommandPalette';
import type { WorkspaceModel } from '@/features/workspace/hooks/use-workspace';

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 8, 23, 12)));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
  it.each([
    { mention: '', day: 23, hour: 0, label: 'Sep 23' },
    { mention: ' @demain', day: 24, hour: 0, label: 'Sep 24' },
    { mention: ' @demain @15h', day: 24, hour: 15, label: 'Sep 24 15h00' },
    { mention: ' @15h', day: 23, hour: 15, label: 'Sep 23 15h00' },
  ])('previews and saves the due date for a task with "$mention"', async ({ mention, day, hour, label }) => {
    const user = userEvent.setup();
    const workspace = workspaceFixture();
    const onOpenChange = vi.fn();
    render(<CommandPalette onOpenChange={onOpenChange} open workspace={workspace} />);

    const search = screen.getByRole('textbox', { name: 'search or create a task...' });
    await user.type(search, `Prepare launch${mention} `);
    await user.keyboard('{Tab}');
    const title = screen.getByRole('textbox', { name: 'new task' });
    expect(title).toHaveValue(`Prepare launch${mention}`);
    expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'project' })).toHaveFocus();

    await user.keyboard('{Tab}');
    await waitFor(() => expect(title).toHaveFocus());
    expect(workspace.createTask).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(workspace.createTask).toHaveBeenCalledExactlyOnceWith('p1', {
      title: 'Prepare launch',
      due_date: new Date(2026, 8, day, hour).toISOString(),
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns to today when an explicit date is removed from the draft', async () => {
    const user = userEvent.setup();
    const workspace = workspaceFixture();
    render(<CommandPalette onOpenChange={vi.fn()} open workspace={workspace} />);

    await user.type(screen.getByRole('textbox', { name: 'search or create a task...' }), 'Prepare launch @demain ');
    await user.keyboard('{Tab}');
    expect(screen.getByText('Sep 24', { exact: true })).toBeInTheDocument();
    await user.keyboard('{Tab}');

    const title = screen.getByRole('textbox', { name: 'new task' });
    await waitFor(() => expect(title).toHaveFocus());
    await user.keyboard('{End}{Backspace>8/}');
    expect(title).toHaveValue('Prepare launch');
    expect(screen.getByText('Sep 23', { exact: true })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(workspace.createTask).toHaveBeenCalledExactlyOnceWith('p1', {
      title: 'Prepare launch',
      due_date: new Date(2026, 8, 23).toISOString(),
    });
  });

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
