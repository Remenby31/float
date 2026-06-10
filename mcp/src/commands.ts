/**
 * Command parser and dispatcher for the float CLI-like MCP tool.
 */

import { FloatAPI, type Project, type Task } from "./api.js";

// Short ID: first 6 chars of UUID
function shortId(id: string): string {
  return id.slice(0, 6);
}

// Fuzzy match: case-insensitive substring
function fuzzyMatch(query: string, text: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

// Find project by fuzzy name match
function findProject(
  projects: Project[],
  query: string
): Project | undefined {
  // Exact match first
  const exact = projects.find(
    (p) => p.title.toLowerCase() === query.toLowerCase()
  );
  if (exact) return exact;
  // Fuzzy match (prefer leaf projects over groups)
  const leaves = projects.filter(
    (p) => !projects.some((c) => c.parent_id === p.id)
  );
  return (
    leaves.find((p) => fuzzyMatch(query, p.title)) ||
    projects.find((p) => fuzzyMatch(query, p.title))
  );
}

// Find task by short ID prefix
function findTask(
  tasks: Task[],
  shortIdQuery: string
): Task | undefined {
  return tasks.find((t) => t.id.startsWith(shortIdQuery));
}

// Format relative date
function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0 && diff <= 7) return d.toLocaleDateString("en", { weekday: "short" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

// Parse natural date to ISO
function parseDate(input: string): string {
  const lower = input.toLowerCase();
  const now = new Date();
  if (lower === "today") {
    return now.toISOString();
  }
  if (lower === "tomorrow") {
    now.setDate(now.getDate() + 1);
    return now.toISOString();
  }
  // Try ISO or common date format
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  throw new Error(`Cannot parse date: ${input}`);
}

export async function executeCommand(
  api: FloatAPI,
  command: string
): Promise<string> {
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(" ");

  if (!cmd) return helpText();

  switch (cmd) {
    case "help":
      return helpText();
    case "projects":
      return cmdProjects(api);
    case "tasks":
      return cmdTasks(api, args);
    case "pending":
      return cmdPending(api);
    case "add":
      return cmdAdd(api, args);
    case "done":
      return cmdDone(api, args);
    case "undone":
      return cmdUndone(api, args);
    case "due":
      return cmdDue(api, args);
    case "move":
      return cmdMove(api, args);
    case "rm":
      return cmdRm(api, args);
    case "note":
      return cmdNote(api, args);
    default:
      return `Unknown command: ${cmd}\n\n${helpText()}`;
  }
}

function helpText(): string {
  return `Commands:
  projects              List all projects grouped by family
  tasks <project>       List tasks for a project (fuzzy name match)
  pending               All pending tasks across projects
  add <project> <title> Create a task
  done <id>             Check a task
  undone <id>           Uncheck a task
  due <id> <date>       Set due date (today, tomorrow, 2025-06-15)
  note <id> <action>    Edit task notes: append "text", replace "old" "new", set "full text", clear
  move <id> <project>   Move task to another project
  rm <id>               Delete a task`;
}

async function cmdProjects(api: FloatAPI): Promise<string> {
  const projects = await api.getProjects();
  const allTasks = await api.getAllTasks();
  const groups = projects.filter((p) => !p.parent_id);
  const lines: string[] = [];

  for (const grp of groups) {
    const children = projects.filter((p) => p.parent_id === grp.id);
    const icon = grp.icon || "●";
    lines.push(`${icon} ${grp.title}`);

    if (children.length === 0) {
      // Standalone project
      const tasks = allTasks.filter((t) => t.project_id === grp.id);
      const pending = tasks.filter((t) => !t.is_done).length;
      const done = tasks.filter((t) => t.is_done).length;
      lines.push(`  ${pending} pending${done ? ` / ${done} done` : ""}`);
    } else {
      for (const child of children) {
        const tasks = allTasks.filter((t) => t.project_id === child.id);
        const pending = tasks.filter((t) => !t.is_done).length;
        const done = tasks.filter((t) => t.is_done).length;
        const stats =
          pending > 0
            ? `${pending} pending${done ? ` / ${done} done` : ""}`
            : done > 0
              ? `— / ${done} done`
              : "empty";
        lines.push(`  ${child.title.padEnd(20)} ${stats}`);
      }
    }
  }
  return lines.join("\n");
}

async function cmdTasks(api: FloatAPI, projectName: string): Promise<string> {
  if (!projectName) return "Usage: tasks <project name>";
  const projects = await api.getProjects();
  const project = findProject(projects, projectName);
  if (!project) return `No project matching "${projectName}"`;

  const tasks = await api.getTasks(project.id);
  const pending = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  const lines: string[] = [`${project.title}:`];
  for (const t of pending) {
    const due = t.due_date ? ` ${relDate(t.due_date)}` : "";
    const note = t.description ? " 📎" : "";
    lines.push(`☐ ${t.title}${note} [${shortId(t.id)}]${due}`);
  }
  if (done.length > 0) {
    lines.push(`— ${done.length} done`);
  }
  return lines.join("\n");
}

async function cmdPending(api: FloatAPI): Promise<string> {
  const projects = await api.getProjects();
  const allTasks = await api.getAllTasks();
  const pending = allTasks.filter((t) => !t.is_done);

  if (pending.length === 0) return "No pending tasks!";

  const lines: string[] = [];
  const byProject = new Map<string, Task[]>();
  for (const t of pending) {
    const arr = byProject.get(t.project_id) || [];
    arr.push(t);
    byProject.set(t.project_id, arr);
  }

  for (const [pid, tasks] of byProject) {
    const proj = projects.find((p) => p.id === pid);
    lines.push(`${proj?.title || "?"}: `);
    for (const t of tasks) {
      const due = t.due_date ? ` ${relDate(t.due_date)}` : "";
      lines.push(`  ☐ ${t.title} [${shortId(t.id)}]${due}`);
    }
  }
  lines.push(`\n${pending.length} total pending`);
  return lines.join("\n");
}

async function cmdAdd(api: FloatAPI, args: string): Promise<string> {
  // First word = project name, rest = task title
  const firstSpace = args.indexOf(" ");
  if (firstSpace < 0) return "Usage: add <project> <task title>";
  const projectQuery = args.slice(0, firstSpace);
  const title = args.slice(firstSpace + 1).trim();
  if (!title) return "Usage: add <project> <task title>";

  const projects = await api.getProjects();
  const project = findProject(projects, projectQuery);
  if (!project) return `No project matching "${projectQuery}"`;

  const task = await api.createTask(project.id, title);
  return `Created: ${title} [${shortId(task.id)}] in ${project.title}`;
}

async function cmdDone(api: FloatAPI, id: string): Promise<string> {
  if (!id) return "Usage: done <task-id>";
  const { task, project } = await resolveTask(api, id);
  await api.updateTask(project.id, task.id, { is_done: true });
  return `✓ ${task.title} [${shortId(task.id)}]`;
}

async function cmdUndone(api: FloatAPI, id: string): Promise<string> {
  if (!id) return "Usage: undone <task-id>";
  const { task, project } = await resolveTask(api, id);
  await api.updateTask(project.id, task.id, { is_done: false });
  return `☐ ${task.title} [${shortId(task.id)}]`;
}

async function cmdDue(api: FloatAPI, args: string): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) return "Usage: due <task-id> <date>";
  const id = parts[0];
  const dateStr = parts.slice(1).join(" ");

  const { task, project } = await resolveTask(api, id);
  const due = parseDate(dateStr);
  await api.updateTask(project.id, task.id, { due_date: due });
  return `${task.title} [${shortId(task.id)}] due ${relDate(due)}`;
}

async function cmdNote(api: FloatAPI, args: string): Promise<string> {
  // note <id> <action> [args...]
  // actions: append "text", replace "old" "new", set "full text", clear, (no action = show)
  const parts = args.match(/^(\S+)\s*(.*)/s);
  if (!parts) return "Usage: note <task-id> [append|replace|set|clear] [args]";
  const id = parts[1];
  const rest = parts[2].trim();

  const { task, project } = await resolveTask(api, id);

  if (!rest) {
    // Show note
    return task.description
      ? `Note for "${task.title}" [${shortId(task.id)}]:\n${task.description}`
      : `No note on "${task.title}" [${shortId(task.id)}]`;
  }

  const actionMatch = rest.match(/^(append|replace|set|clear)\s*([\s\S]*)/i);
  if (!actionMatch) {
    // Default: set the note
    await api.updateTask(project.id, task.id, { description: rest });
    return `Note set on "${task.title}" [${shortId(task.id)}]`;
  }

  const action = actionMatch[1].toLowerCase();
  const actionArgs = actionMatch[2].trim();
  const current = task.description || "";

  if (action === "clear") {
    await api.updateTask(project.id, task.id, { description: null });
    return `Note cleared on "${task.title}" [${shortId(task.id)}]`;
  }

  if (action === "set") {
    await api.updateTask(project.id, task.id, { description: actionArgs });
    return `Note set on "${task.title}" [${shortId(task.id)}]`;
  }

  if (action === "append") {
    const newDesc = current ? `${current}\n${actionArgs}` : actionArgs;
    await api.updateTask(project.id, task.id, { description: newDesc });
    return `Appended to note on "${task.title}" [${shortId(task.id)}]`;
  }

  if (action === "replace") {
    // replace "old text" "new text"
    const replaceMatch = actionArgs.match(
      /^"([^"]*?)"\s+"([^"]*)"$|^'([^']*?)'\s+'([^']*)'$/
    );
    if (!replaceMatch)
      return 'Usage: note <id> replace "old text" "new text"';
    const oldText = replaceMatch[1] ?? replaceMatch[3];
    const newText = replaceMatch[2] ?? replaceMatch[4];
    if (!current.includes(oldText))
      return `"${oldText}" not found in note`;
    const updated = current.replace(oldText, newText);
    await api.updateTask(project.id, task.id, { description: updated });
    return `Replaced in note on "${task.title}" [${shortId(task.id)}]`;
  }

  return "Unknown note action. Use: append, replace, set, clear";
}

async function cmdMove(api: FloatAPI, args: string): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) return "Usage: move <task-id> <project>";
  const id = parts[0];
  const projectQuery = parts.slice(1).join(" ");

  const { task, project: fromProject } = await resolveTask(api, id);
  const projects = await api.getProjects();
  const toProject = findProject(projects, projectQuery);
  if (!toProject) return `No project matching "${projectQuery}"`;

  await api.updateTask(fromProject.id, task.id, {
    new_project_id: toProject.id,
  });
  return `Moved "${task.title}" [${shortId(task.id)}] → ${toProject.title}`;
}

async function cmdRm(api: FloatAPI, id: string): Promise<string> {
  if (!id) return "Usage: rm <task-id>";
  const { task, project } = await resolveTask(api, id);
  await api.deleteTask(project.id, task.id);
  return `Deleted: ${task.title} [${shortId(task.id)}]`;
}

// Resolve a short task ID to full task + project
async function resolveTask(
  api: FloatAPI,
  shortIdQuery: string
): Promise<{ task: Task; project: Project }> {
  const allTasks = await api.getAllTasks();
  const task = findTask(allTasks, shortIdQuery);
  if (!task) throw new Error(`No task matching ID "${shortIdQuery}"`);

  const projects = await api.getProjects();
  const project = projects.find((p) => p.id === task.project_id);
  if (!project) throw new Error(`Project not found for task "${task.title}"`);

  return { task, project };
}
