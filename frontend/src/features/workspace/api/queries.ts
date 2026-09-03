import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export const workspaceKeys = {
  projects: ['projects'] as const,
  tasks: ['tasks'] as const,
  attachments: (projectId: string, taskId: string) => ['attachments', projectId, taskId] as const,
};

export const projectsQueryOptions = () =>
  queryOptions({
    queryKey: workspaceKeys.projects,
    queryFn: api.listProjects,
  });

export const tasksQueryOptions = () =>
  queryOptions({
    queryKey: workspaceKeys.tasks,
    queryFn: api.listAllTasks,
  });

export const attachmentsQueryOptions = (projectId: string, taskId: string) =>
  queryOptions({
    queryKey: workspaceKeys.attachments(projectId, taskId),
    queryFn: () => api.listAttachments(projectId, taskId),
    staleTime: 15_000,
  });
