import { useCallback } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';

import {
  api,
  type CreateProjectInput,
  type CreateTaskInput,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from '@/lib/api/client';
import { toast } from '@/stores/toast-store';
import type { Project, Task } from '@/types/api';
import { projectsQueryOptions, tasksQueryOptions, workspaceKeys } from '@/features/workspace/api/queries';
import { useHistoryStore } from '@/features/workspace/stores/history-store';

function replaceTask(tasks: Task[] | undefined, updated: Task): Task[] {
  if (!tasks) return [updated];
  const exists = tasks.some((task) => task.id === updated.id);
  return exists ? tasks.map((task) => (task.id === updated.id ? updated : task)) : [...tasks, updated];
}

function replaceProject(projects: Project[] | undefined, updated: Project): Project[] {
  if (!projects) return [updated];
  const exists = projects.some((project) => project.id === updated.id);
  return exists
    ? projects.map((project) => (project.id === updated.id ? updated : project))
    : [...projects, updated];
}

export function useWorkspace() {
  const queryClient = useQueryClient();
  const projectsQuery = useSuspenseQuery(projectsQueryOptions());
  const tasksQuery = useSuspenseQuery(tasksQueryOptions());
  const pushHistory = useHistoryStore((state) => state.push);
  const markRecentlyAdded = useHistoryStore((state) => state.markRecentlyAdded);
  const trackDone = useHistoryStore((state) => state.trackDone);

  const createProjectMutation = useMutation({
    mutationKey: ['projects', 'create'],
    mutationFn: api.createProject,
  });
  const updateProjectMutation = useMutation({
    mutationKey: ['projects', 'update'],
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) => api.updateProject(id, data),
  });
  const deleteProjectMutation = useMutation({
    mutationKey: ['projects', 'delete'],
    mutationFn: api.deleteProject,
  });
  const reorderProjectsMutation = useMutation({
    mutationKey: ['projects', 'reorder'],
    mutationFn: api.reorderProjects,
  });
  const createTaskMutation = useMutation({
    mutationKey: ['tasks', 'create'],
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateTaskInput }) =>
      api.createTask(projectId, data),
  });
  const updateTaskMutation = useMutation({
    mutationKey: ['tasks', 'update'],
    mutationFn: ({ projectId, id, data }: { projectId: string; id: string; data: UpdateTaskInput }) =>
      api.updateTask(projectId, id, data),
  });
  const moveTaskMutation = useMutation({
    mutationKey: ['tasks', 'move'],
    mutationFn: ({ fromProjectId, taskId, toProjectId }: { fromProjectId: string; taskId: string; toProjectId: string }) =>
      api.moveTask(fromProjectId, taskId, toProjectId),
  });
  const deleteTaskMutation = useMutation({
    mutationKey: ['tasks', 'delete'],
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => api.deleteTask(projectId, id),
  });
  const reorderTasksMutation = useMutation({
    mutationKey: ['tasks', 'reorder'],
    mutationFn: ({ projectId, taskIds }: { projectId: string; taskIds: string[] }) =>
      api.reorderTasks(projectId, taskIds),
  });

  const commitTaskUpdate = useCallback(
    async (projectId: string, id: string, data: UpdateTaskInput) => {
      const currentProjectId = queryClient
        .getQueryData<Task[]>(workspaceKeys.tasks)
        ?.find((task) => task.id === id)?.project_id ?? projectId;
      const updated = await updateTaskMutation.mutateAsync({ projectId: currentProjectId, id, data });
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, (tasks) => replaceTask(tasks, updated));
      if (data.is_done !== undefined) trackDone(id, data.is_done);
      return updated;
    },
    [queryClient, trackDone, updateTaskMutation],
  );

  const createProject = useCallback(
    async (data: CreateProjectInput) => {
      try {
        const project = await createProjectMutation.mutateAsync(data);
        queryClient.setQueryData<Project[]>(workspaceKeys.projects, (projects) => replaceProject(projects, project));
        if (data.parent_id) await queryClient.invalidateQueries({ queryKey: workspaceKeys.tasks });
        return project;
      } catch (error) {
        toast.error('Failed to create project');
        throw error;
      }
    },
    [createProjectMutation, queryClient],
  );

  const updateProject = useCallback(
    async (id: string, data: UpdateProjectInput) => {
      const previous = queryClient.getQueryData<Project[]>(workspaceKeys.projects);
      queryClient.setQueryData<Project[]>(workspaceKeys.projects, (projects) =>
        projects?.map((project) => (project.id === id ? { ...project, ...data } : project)) ?? [],
      );
      try {
        const updated = await updateProjectMutation.mutateAsync({ id, data });
        queryClient.setQueryData<Project[]>(workspaceKeys.projects, (projects) => replaceProject(projects, updated));
        return updated;
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.projects, previous);
        toast.error('Failed to update project');
        throw error;
      }
    },
    [queryClient, updateProjectMutation],
  );

  const reorderProjects = useCallback(
    async (projectIds: string[]) => {
      const previous = queryClient.getQueryData<Project[]>(workspaceKeys.projects);
      queryClient.setQueryData<Project[]>(workspaceKeys.projects, (projects = []) =>
        projects
          .map((project) => {
            const position = projectIds.indexOf(project.id);
            return position >= 0 ? { ...project, position } : project;
          })
          .sort((a, b) => a.position - b.position),
      );
      try {
        await reorderProjectsMutation.mutateAsync(projectIds);
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.projects, previous);
        toast.error('Failed to reorder projects');
        throw error;
      }
    },
    [queryClient, reorderProjectsMutation],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const previousProjects = queryClient.getQueryData<Project[]>(workspaceKeys.projects) ?? [];
      const previousTasks = queryClient.getQueryData<Task[]>(workspaceKeys.tasks) ?? [];
      const projectIds = new Set([id, ...previousProjects.filter((project) => project.parent_id === id).map((project) => project.id)]);
      queryClient.setQueryData<Project[]>(workspaceKeys.projects, previousProjects.filter((project) => !projectIds.has(project.id)));
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, previousTasks.filter((task) => !projectIds.has(task.project_id)));
      try {
        await deleteProjectMutation.mutateAsync(id);
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.projects, previousProjects);
        queryClient.setQueryData(workspaceKeys.tasks, previousTasks);
        toast.error('Failed to delete project');
        throw error;
      }
    },
    [deleteProjectMutation, queryClient],
  );

  const createTask = useCallback(
    async (projectId: string, data: CreateTaskInput) => {
      try {
        const task = await createTaskMutation.mutateAsync({ projectId, data });
        queryClient.setQueryData<Task[]>(workspaceKeys.tasks, (tasks) => replaceTask(tasks, task));
        markRecentlyAdded(task.id);
        return task;
      } catch (error) {
        toast.error('Failed to create task');
        throw error;
      }
    },
    [createTaskMutation, markRecentlyAdded, queryClient],
  );

  const updateTask = useCallback(
    async (projectId: string, id: string, data: UpdateTaskInput, recordHistory = true) => {
      const previousTasks = queryClient.getQueryData<Task[]>(workspaceKeys.tasks) ?? [];
      const previous = previousTasks.find((task) => task.id === id);
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, previousTasks.map((task) => (task.id === id ? { ...task, ...data } : task)));
      if (data.is_done !== undefined) trackDone(id, data.is_done);

      try {
        const updated = await commitTaskUpdate(projectId, id, data);
        if (recordHistory && previous && data.is_done !== undefined && previous.is_done !== data.is_done) {
          pushHistory({
            redo: async () => void (await commitTaskUpdate(projectId, id, { is_done: data.is_done })),
            undo: async () => void (await commitTaskUpdate(projectId, id, { is_done: previous.is_done })),
          });
        }
        return updated;
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.tasks, previousTasks);
        if (previous) trackDone(id, previous.is_done);
        toast.error('Failed to update task');
        throw error;
      }
    },
    [commitTaskUpdate, pushHistory, queryClient, trackDone],
  );

  const commitMove = useCallback(
    async (fromProjectId: string, taskId: string, toProjectId: string) => {
      const updated = await moveTaskMutation.mutateAsync({ fromProjectId, taskId, toProjectId });
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, (tasks) => replaceTask(tasks, updated));
      return updated;
    },
    [moveTaskMutation, queryClient],
  );

  const commitMoveFromCurrentProject = useCallback(
    async (taskId: string, toProjectId: string, fallbackProjectId: string) => {
      const currentProjectId = queryClient
        .getQueryData<Task[]>(workspaceKeys.tasks)
        ?.find((task) => task.id === taskId)?.project_id ?? fallbackProjectId;
      return commitMove(currentProjectId, taskId, toProjectId);
    },
    [commitMove, queryClient],
  );

  const moveTask = useCallback(
    async (fromProjectId: string, taskId: string, toProjectId: string, recordHistory = true) => {
      if (fromProjectId === toProjectId) return queryClient.getQueryData<Task[]>(workspaceKeys.tasks)?.find((task) => task.id === taskId);
      const previousTasks = queryClient.getQueryData<Task[]>(workspaceKeys.tasks) ?? [];
      const actualFromProjectId = previousTasks.find((task) => task.id === taskId)?.project_id ?? fromProjectId;
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, previousTasks.map((task) => (task.id === taskId ? { ...task, project_id: toProjectId } : task)));
      try {
        const updated = await commitMove(actualFromProjectId, taskId, toProjectId);
        if (recordHistory) {
          pushHistory({
            redo: async () => void (await commitMoveFromCurrentProject(taskId, toProjectId, actualFromProjectId)),
            undo: async () => void (await commitMoveFromCurrentProject(taskId, actualFromProjectId, toProjectId)),
          });
        }
        return updated;
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.tasks, previousTasks);
        toast.error('Failed to move task');
        throw error;
      }
    },
    [commitMove, commitMoveFromCurrentProject, pushHistory, queryClient],
  );

  const deleteTask = useCallback(
    async (projectId: string, id: string, recordHistory = true) => {
      const previousTasks = queryClient.getQueryData<Task[]>(workspaceKeys.tasks) ?? [];
      const deleted = previousTasks.find((task) => task.id === id);
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, previousTasks.filter((task) => task.id !== id));

      try {
        await deleteTaskMutation.mutateAsync({ projectId, id });
        if (recordHistory && deleted) {
          let restoredId = '';
          pushHistory({
            redo: async () => {
              if (!restoredId) return;
              await api.deleteTask(projectId, restoredId);
              queryClient.setQueryData<Task[]>(workspaceKeys.tasks, (tasks = []) => tasks.filter((task) => task.id !== restoredId));
            },
            undo: async () => {
              let restored = await api.createTask(projectId, {
                title: deleted.title,
                description: deleted.description ?? undefined,
                due_date: deleted.due_date ?? undefined,
                weight: deleted.weight,
              });
              if (deleted.is_done) restored = await api.updateTask(projectId, restored.id, { is_done: true });
              restoredId = restored.id;
              queryClient.setQueryData<Task[]>(workspaceKeys.tasks, (tasks) => replaceTask(tasks, restored));
            },
          });
        }
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.tasks, previousTasks);
        toast.error('Failed to delete task');
        throw error;
      }
    },
    [deleteTaskMutation, pushHistory, queryClient],
  );

  const reorderTasks = useCallback(
    async (projectId: string, taskIds: string[]) => {
      const previous = queryClient.getQueryData<Task[]>(workspaceKeys.tasks) ?? [];
      queryClient.setQueryData<Task[]>(workspaceKeys.tasks, previous.map((task) => {
        if (task.project_id !== projectId) return task;
        const position = taskIds.indexOf(task.id);
        return position >= 0 ? { ...task, position } : task;
      }));
      try {
        await reorderTasksMutation.mutateAsync({ projectId, taskIds });
      } catch (error) {
        queryClient.setQueryData(workspaceKeys.tasks, previous);
        toast.error('Failed to reorder tasks');
        throw error;
      }
    },
    [queryClient, reorderTasksMutation],
  );

  return {
    projects: projectsQuery.data,
    tasks: tasksQuery.data,
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    reorderTasks,
    refreshProjects: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.projects }),
    refreshTasks: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.tasks }),
  };
}

export type WorkspaceModel = ReturnType<typeof useWorkspace>;
