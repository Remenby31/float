/**
 * Float API client — handles auth and HTTP calls.
 */

interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  is_archived: boolean;
  position: number;
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  weight: string;
  position: number;
  is_done: boolean;
  done_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Label {
  id: string;
  project_id: string;
  title: string;
  color: string;
  created_at: string;
}

interface TaskLabel {
  task_id: string;
  label_id: string;
}

export type { Project, Task, Label, TaskLabel };

export class FloatAPI {
  private baseUrl: string;
  private email: string;
  private password: string;
  private token: string | null = null;

  constructor(baseUrl: string, email: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.email = email;
    this.password = password;
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    this.token = data.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.token) await this.login();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(options.headers as Record<string, string>),
      },
    });

    // Re-login on 401
    if (res.status === 401) {
      await this.login();
      const retry = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
          ...(options.headers as Record<string, string>),
        },
      });
      if (!retry.ok) throw new Error(`API error: ${retry.status}`);
      return retry.json();
    }

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async getProjects(): Promise<Project[]> {
    return this.request("/projects");
  }

  async getTasks(projectId: string): Promise<Task[]> {
    return this.request(`/projects/${projectId}/tasks`);
  }

  async getAllTasks(): Promise<Task[]> {
    return this.request("/tasks");
  }

  async createTask(
    projectId: string,
    title: string,
    opts?: { due_date?: string; weight?: string; description?: string }
  ): Promise<Task> {
    const body: Record<string, unknown> = { title };
    if (opts?.due_date) body.due_date = opts.due_date;
    if (opts?.weight) body.weight = opts.weight;
    if (opts?.description) body.description = opts.description;
    return this.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateTask(
    projectId: string,
    taskId: string,
    data: Partial<{
      title: string;
      description: string | null;
      weight: string;
      is_done: boolean;
      due_date: string | null;
      new_project_id: string;
    }>
  ): Promise<Task> {
    return this.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await this.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  // ── Labels ───────────────────────────────────────────────────────
  async getLabels(projectId: string): Promise<Label[]> {
    return this.request(`/projects/${projectId}/labels`);
  }

  async createLabel(projectId: string, title: string, color?: string): Promise<Label> {
    const body: Record<string, string> = { title };
    if (color) body.color = color;
    return this.request(`/projects/${projectId}/labels`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteLabel(projectId: string, labelId: string): Promise<void> {
    await this.request(`/projects/${projectId}/labels/${labelId}`, {
      method: "DELETE",
    });
  }

  async attachLabel(projectId: string, taskId: string, labelId: string): Promise<void> {
    await this.request(`/projects/${projectId}/tasks/${taskId}/labels/${labelId}`, {
      method: "PUT",
    });
  }

  async detachLabel(projectId: string, taskId: string, labelId: string): Promise<void> {
    await this.request(`/projects/${projectId}/tasks/${taskId}/labels/${labelId}`, {
      method: "DELETE",
    });
  }
}
