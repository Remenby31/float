/**
 * Command parser and dispatcher for the float CLI-like MCP tool.
 * Designed to be tolerant, helpful, and token-efficient for LLMs.
 */

import { FloatAPI, type Project, type Task } from "./api.js";

// ── Aliases ─────────────────────────────────────────────────────────
// Maps every reasonable variant to the canonical command name.
const COMMAND_ALIASES: Record<string, string> = {
  // projects
  projects: "projects", project: "projects", proj: "projects", projets: "projects", projet: "projects", ls: "projects", list: "projects",
  // tasks
  tasks: "tasks", task: "tasks", taches: "tasks", tâches: "tasks", tache: "tasks", tâche: "tasks",
  // pending
  pending: "pending", todo: "pending", todos: "pending", open: "pending",
  // add
  add: "add", create: "add", new: "add", "+": "add",
  // done
  done: "done", check: "done", finish: "done", complete: "done", close: "done", "✓": "done",
  // undone
  undone: "undone", uncheck: "undone", undo: "undone", reopen: "undone", uncomplete: "undone",
  // due
  due: "due", deadline: "due", schedule: "due",
  // note
  note: "note", notes: "note", desc: "note", description: "note",
  // move
  move: "move", mv: "move",
  // weight
  weight: "weight", priority: "weight", prio: "weight", w: "weight",
  // label
  label: "label", labels: "label", tag: "label", tags: "label",
  // rm
  rm: "rm", remove: "rm", delete: "rm", del: "rm", trash: "rm",
  // help
  help: "help", "?": "help", h: "help",
};

// ── Text normalization ──────────────────────────────────────────────
/** Strip accents and lowercase for matching. */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ── Short IDs ───────────────────────────────────────────────────────
function shortId(id: string): string {
  return id.slice(0, 6);
}

// ── Fuzzy project matching ──────────────────────────────────────────
interface ScoredProject { project: Project; score: number }

function scoreProject(query: string, project: Project): number {
  const q = normalize(query);
  const t = normalize(project.title);
  if (t === q) return 100;               // exact
  if (t.startsWith(q)) return 80;        // prefix
  if (t.includes(q)) return 60;          // contains
  // token match: any word in the title starts with the query
  if (t.split(/\s+/).some(w => w.startsWith(q))) return 50;
  return 0;
}

function findProject(projects: Project[], query: string): Project | undefined {
  const leaves = projects.filter(p => !projects.some(c => c.parent_id === p.id));
  const scored: ScoredProject[] = [];
  for (const p of projects) {
    const s = scoreProject(query, p);
    if (s > 0) {
      // Boost leaves (actual task containers) slightly
      const bonus = leaves.includes(p) ? 5 : 0;
      scored.push({ project: p, score: s + bonus });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.project;
}

function projectSuggestions(projects: Project[], query: string): string {
  const leaves = projects.filter(p => !projects.some(c => c.parent_id === p.id));
  const names = leaves.map(p => p.title).join(", ");
  return `No project matching "${query}". Available: ${names}`;
}

// ── Flexible task resolution ────────────────────────────────────────
function findTaskFlexible(tasks: Task[], query: string): Task | Task[] | undefined {
  // Try short ID prefix (any length ≥ 3)
  const byId = tasks.filter(t => t.id.startsWith(query));
  if (byId.length === 1) return byId[0];
  if (byId.length > 1) return byId; // ambiguous

  // Try exact title match
  const nq = normalize(query);
  const byTitle = tasks.find(t => normalize(t.title) === nq);
  if (byTitle) return byTitle;

  // Try title substring
  const bySubstring = tasks.filter(t => normalize(t.title).includes(nq));
  if (bySubstring.length === 1) return bySubstring[0];
  if (bySubstring.length > 1) return bySubstring; // ambiguous

  return undefined;
}

async function resolveTask(api: FloatAPI, query: string): Promise<{ task: Task; project: Project }> {
  const allTasks = await api.getAllTasks();
  const result = findTaskFlexible(allTasks, query);

  if (!result) {
    throw new Error(`No task matching "${query}". Use \`pending\` to see task IDs.`);
  }

  if (Array.isArray(result)) {
    const items = result.slice(0, 5).map(t =>
      `  ${t.is_done ? "✓" : "☐"} ${t.title} [${shortId(t.id)}]`
    ).join("\n");
    throw new Error(`Multiple tasks match "${query}":\n${items}\nUse a more specific ID.`);
  }

  const projects = await api.getProjects();
  const project = projects.find(p => p.id === result.project_id);
  if (!project) throw new Error(`Project not found for task "${result.title}"`);

  return { task: result, project };
}

// ── Time parsing helper ────────────────────────────────────────────
/** Extract a time component from the end of a date string. Returns [datePartOrNull, hours, minutes] or null. */
function extractTime(input: string): { datePart: string | null; hours: number; minutes: number } | null {
  const lower = input.toLowerCase().trim();

  // French shortcuts: "ce soir" → 20:00, "ce midi" → 12:00, "ce matin" → 8:00
  const frenchTimes: Record<string, [number, number]> = {
    "ce soir": [20, 0], "soir": [20, 0], "tonight": [20, 0],
    "ce midi": [12, 0], "midi": [12, 0], "noon": [12, 0],
    "ce matin": [8, 0], "matin": [8, 0],
  };

  // Check if the whole input is a French time shortcut (implicitly today)
  if (frenchTimes[lower]) {
    const [h, m] = frenchTimes[lower];
    return { datePart: null, hours: h, minutes: m };
  }

  // Check if input ends with a French time shortcut after a date part
  for (const [key, [h, m]] of Object.entries(frenchTimes)) {
    if (lower.endsWith(key)) {
      const dp = lower.slice(0, -key.length).trim();
      if (dp) return { datePart: dp, hours: h, minutes: m };
    }
  }

  // "18h" "18h30" "8h" at the end
  const hMatch = lower.match(/^(.*?)\s+(\d{1,2})h(\d{2})?$/);
  if (hMatch) {
    return { datePart: hMatch[1] || null, hours: parseInt(hMatch[2]), minutes: parseInt(hMatch[3] || "0") };
  }
  // Just "18h" or "18h30" alone (implies today)
  const hAlone = lower.match(/^(\d{1,2})h(\d{2})?$/);
  if (hAlone) {
    return { datePart: null, hours: parseInt(hAlone[1]), minutes: parseInt(hAlone[2] || "0") };
  }

  // "HH:MM" at the end (e.g. "today 18:00", "2025-06-15 14:30")
  const colonMatch = lower.match(/^(.*?)\s+(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return { datePart: colonMatch[1] || null, hours: parseInt(colonMatch[2]), minutes: parseInt(colonMatch[3]) };
  }
  // Just "HH:MM" alone
  const colonAlone = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (colonAlone) {
    return { datePart: null, hours: parseInt(colonAlone[1]), minutes: parseInt(colonAlone[2]) };
  }

  return null;
}

// ── Date parsing ────────────────────────────────────────────────────
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_SHORTS = ["sun","mon","tue","wed","thu","fri","sat"];

function parseDateOnly(input: string): Date {
  const lower = input.toLowerCase().trim();
  const now = new Date();

  if (lower === "today" || lower === "") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (lower === "tomorrow") {
    now.setDate(now.getDate() + 1);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (lower === "yesterday") {
    now.setDate(now.getDate() - 1);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // "next week" → next Monday
  if (lower === "next week") {
    const daysUntilMon = (8 - now.getDay()) % 7 || 7;
    now.setDate(now.getDate() + daysUntilMon);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // "in N days/weeks/hours/minutes"
  const inMatch = lower.match(/^in\s+(\d+)\s+(day|days|week|weeks|hour|hours|h|minute|minutes|min)$/);
  if (inMatch) {
    const n = parseInt(inMatch[1]);
    const unit = inMatch[2];
    if (unit.startsWith("week")) {
      now.setDate(now.getDate() + n * 7);
    } else if (unit.startsWith("day")) {
      now.setDate(now.getDate() + n);
    } else if (unit === "h" || unit.startsWith("hour")) {
      return new Date(now.getTime() + n * 60 * 60 * 1000);
    } else {
      return new Date(now.getTime() + n * 60 * 1000);
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Day name: "monday", "tue" → next occurrence
  const dayIdx = DAY_NAMES.indexOf(lower) !== -1 ? DAY_NAMES.indexOf(lower) : DAY_SHORTS.indexOf(lower);
  if (dayIdx !== -1) {
    const diff = (dayIdx - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // DD/MM or DD/MM/YYYY
  const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    const year = slashMatch[3] ? parseInt(slashMatch[3]) + (slashMatch[3].length === 2 ? 2000 : 0) : now.getFullYear();
    return new Date(year, month, day);
  }

  // Try standard date parsing (YYYY-MM-DD, etc.)
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;

  throw new Error(`Cannot parse date "${input}". Try: today, tomorrow, monday, in 3 days, next week, 2025-06-15, 15/06, today 18h, ce soir`);
}

function parseDate(input: string): string {
  // First check for time component
  const timeInfo = extractTime(input);
  if (timeInfo) {
    const base = parseDateOnly(timeInfo.datePart || "today");
    base.setHours(timeInfo.hours, timeInfo.minutes, 0, 0);
    return base.toISOString();
  }

  // "in N hours/minutes" returns a datetime directly
  const lower = input.toLowerCase().trim();
  const inTimeMatch = lower.match(/^in\s+(\d+)\s+(hour|hours|h|minute|minutes|min)$/);
  if (inTimeMatch) {
    const n = parseInt(inTimeMatch[1]);
    const unit = inTimeMatch[2];
    const now = new Date();
    if (unit === "h" || unit.startsWith("hour")) {
      return new Date(now.getTime() + n * 60 * 60 * 1000).toISOString();
    } else {
      return new Date(now.getTime() + n * 60 * 1000).toISOString();
    }
  }

  return parseDateOnly(input).toISOString();
}

function hasTime(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const timeSuffix = hasTime(iso) ? ` ${formatTime(iso)}` : "";
  if (diff === 0) return `today${timeSuffix}`;
  if (diff === 1) return `tomorrow${timeSuffix}`;
  if (diff === -1) return `yesterday${timeSuffix}`;
  if (diff > 0 && diff <= 7) return d.toLocaleDateString("en", { weekday: "short" }) + timeSuffix;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" }) + timeSuffix;
}

// ── Weight / Priority ──────────────────────────────────────────────
const WEIGHT_ALIASES: Record<string, string> = {
  low: "low", lo: "low", l: "low", basse: "low", faible: "low",
  medium: "medium", med: "medium", m: "medium", moyenne: "medium", moyen: "medium",
  high: "high", hi: "high", h: "high", haute: "high", haut: "high",
  critical: "critical", crit: "critical", c: "critical", critique: "critical", urgent: "critical",
};
function parseWeight(input: string): string {
  const w = WEIGHT_ALIASES[input.toLowerCase().trim()];
  if (!w) throw new Error(`Unknown weight "${input}". Use: low, medium, high, critical`);
  return w;
}

function weightIcon(w: string): string {
  switch (w) {
    case "critical": return "!!!";
    case "high": return "!!";
    case "low": return "~";
    default: return "";
  }
}

// ── Suggest closest command ─────────────────────────────────────────
function suggestCommand(input: string): string {
  const n = normalize(input);
  // Check all alias keys for closeness
  let bestKey = "";
  let bestDist = Infinity;
  for (const key of Object.keys(COMMAND_ALIASES)) {
    const d = editDistance(n, key);
    if (d < bestDist) { bestDist = d; bestKey = key; }
  }
  if (bestDist <= 2) {
    return `Unknown command "${input}". Did you mean \`${COMMAND_ALIASES[bestKey]}\`?\n\n${helpText()}`;
  }
  return `Unknown command "${input}".\n\n${helpText()}`;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

// ── Main dispatcher ─────────────────────────────────────────────────
export async function executeCommand(api: FloatAPI, command: string): Promise<string> {
  const parts = command.trim().split(/\s+/);
  const rawCmd = parts[0] || "";
  const args = parts.slice(1).join(" ");

  if (!rawCmd) return helpText();

  const canonical = COMMAND_ALIASES[rawCmd.toLowerCase()];
  if (!canonical) return suggestCommand(rawCmd);

  switch (canonical) {
    case "help":     return helpText();
    case "projects": return cmdProjects(api);
    case "tasks":    return cmdTasks(api, args);
    case "pending":  return cmdPending(api);
    case "add":      return cmdAdd(api, args);
    case "done":     return cmdDone(api, args);
    case "undone":   return cmdUndone(api, args);
    case "due":      return cmdDue(api, args);
    case "weight":   return cmdWeight(api, args);
    case "label":    return cmdLabel(api, args);
    case "move":     return cmdMove(api, args);
    case "rm":       return cmdRm(api, args);
    case "note":     return cmdNote(api, args);
    default:         return helpText();
  }
}

function helpText(): string {
  return `Commands:
  projects              List projects (aliases: proj, ls, list)
  tasks <project>       Tasks for a project (aliases: taches, tâches)
  pending               All pending tasks (aliases: todo, open)
  add <project> <title> Create task (aliases: create, new, +)
  done <id>             Check task (aliases: check, finish, complete)
  undone <id>           Uncheck (aliases: uncheck, undo, reopen)
  due <id> <date>       Set due date/time (today 18h, ce soir, tomorrow 14:00, in 2 hours)
  weight <id> <level>   Set priority: low, medium, high, critical (aliases: priority, prio)
  label <id> <action>   Labels: list, add <name>, rm <name> (aliases: tag, tags)
  note <id> [action]    Notes: show, append "text", replace "old" "new", set "text", clear
  move <id> <project>   Move task (alias: mv)
  rm <id>               Delete task (aliases: delete, del, remove)

IDs: use first 6 chars of task ID, or task title for matching.
Projects: fuzzy matched, accent-insensitive.
Dates: today, tomorrow, monday, in 3 days, next week, 15/06, 2025-06-15
Times: 18h, 18h30, 14:00, ce soir, midi, tonight, in 2 hours`;
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdProjects(api: FloatAPI): Promise<string> {
  const projects = await api.getProjects();
  const allTasks = await api.getAllTasks();
  const groups = projects.filter(p => !p.parent_id);
  const lines: string[] = [];

  for (const grp of groups) {
    const children = projects.filter(p => p.parent_id === grp.id);
    const icon = grp.icon || "●";
    lines.push(`${icon} ${grp.title}`);

    if (children.length === 0) {
      const tasks = allTasks.filter(t => t.project_id === grp.id);
      const pending = tasks.filter(t => !t.is_done).length;
      const done = tasks.filter(t => t.is_done).length;
      lines.push(`  ${pending} pending${done ? ` / ${done} done` : ""}`);
    } else {
      for (const child of children) {
        const tasks = allTasks.filter(t => t.project_id === child.id);
        const pending = tasks.filter(t => !t.is_done).length;
        const done = tasks.filter(t => t.is_done).length;
        const stats = pending > 0
          ? `${pending} pending${done ? ` / ${done} done` : ""}`
          : done > 0 ? `— / ${done} done` : "empty";
        lines.push(`  ${child.title.padEnd(20)} ${stats}`);
      }
    }
  }
  return lines.join("\n");
}

async function cmdTasks(api: FloatAPI, projectName: string): Promise<string> {
  // No arg → fallback to pending
  if (!projectName) return cmdPending(api);

  const projects = await api.getProjects();
  const project = findProject(projects, projectName);
  if (!project) return projectSuggestions(projects, projectName);

  const tasks = await api.getTasks(project.id);
  const pending = tasks.filter(t => !t.is_done);
  const done = tasks.filter(t => t.is_done);

  const lines: string[] = [`${project.title}:`];
  for (const t of pending) {
    const due = t.due_date ? ` ${relDate(t.due_date)}` : "";
    const note = t.description ? " 📎" : "";
    const wi = weightIcon(t.weight);
    const wp = wi ? ` ${wi}` : "";
    lines.push(`☐ ${t.title}${note}${wp} [${shortId(t.id)}]${due}`);
  }
  if (done.length > 0) lines.push(`— ${done.length} done`);
  if (pending.length === 0 && done.length === 0) lines.push("  (empty)");
  return lines.join("\n");
}

async function cmdPending(api: FloatAPI): Promise<string> {
  const projects = await api.getProjects();
  const allTasks = await api.getAllTasks();
  const pending = allTasks.filter(t => !t.is_done);

  if (pending.length === 0) return "No pending tasks!";

  const lines: string[] = [];
  const byProject = new Map<string, Task[]>();
  for (const t of pending) {
    const arr = byProject.get(t.project_id) || [];
    arr.push(t);
    byProject.set(t.project_id, arr);
  }

  for (const [pid, tasks] of byProject) {
    const proj = projects.find(p => p.id === pid);
    lines.push(`${proj?.title || "?"}:`);
    for (const t of tasks) {
      const due = t.due_date ? ` ${relDate(t.due_date)}` : "";
      const wi = weightIcon(t.weight);
      const wp = wi ? ` ${wi}` : "";
      lines.push(`  ☐ ${t.title}${wp} [${shortId(t.id)}]${due}`);
    }
  }
  lines.push(`\n${pending.length} total pending`);
  return lines.join("\n");
}

async function cmdAdd(api: FloatAPI, args: string): Promise<string> {
  if (!args.trim()) return 'Usage: add <project> <title>\nExample: add Général Fix the login bug';

  const projects = await api.getProjects();
  const leaves = projects.filter(p => !projects.some(c => c.parent_id === p.id));

  // Try each word as potential project name, longest prefix first
  let bestProject: Project | undefined;
  let bestIdx = -1;
  const words = args.split(/\s+/);

  // Try multi-word project names (up to 3 words)
  for (let len = Math.min(3, words.length - 1); len >= 1; len--) {
    const candidate = words.slice(0, len).join(" ");
    const match = findProject(projects, candidate);
    if (match && leaves.includes(match)) {
      bestProject = match;
      bestIdx = len;
      break;
    }
    // Also try from the end (inverted order: title first, project last)
    const candidateEnd = words.slice(-len).join(" ");
    const matchEnd = findProject(projects, candidateEnd);
    if (matchEnd && leaves.includes(matchEnd)) {
      bestProject = matchEnd;
      bestIdx = -(words.length - len); // negative = from end
      break;
    }
  }

  if (!bestProject) {
    return `Could not find a project in: "${args}"\n${projectSuggestions(projects, words[0])}`;
  }

  const title = bestIdx > 0
    ? words.slice(bestIdx).join(" ")
    : words.slice(0, words.length + bestIdx).join(" ");

  if (!title.trim()) return `Matched project "${bestProject.title}" but no task title provided.\nUsage: add ${bestProject.title} <title>`;

  const task = await api.createTask(bestProject.id, title.trim());
  return `Created: ${title.trim()} [${shortId(task.id)}] in ${bestProject.title}`;
}

async function cmdDone(api: FloatAPI, query: string): Promise<string> {
  if (!query) return 'Usage: done <task-id or title>\nExample: done a3f2c1';
  const { task, project } = await resolveTask(api, query);
  if (task.is_done) return `Already done: ✓ ${task.title} [${shortId(task.id)}]`;
  await api.updateTask(project.id, task.id, { is_done: true });
  return `✓ ${task.title} [${shortId(task.id)}]`;
}

async function cmdUndone(api: FloatAPI, query: string): Promise<string> {
  if (!query) return 'Usage: undone <task-id or title>\nExample: undone a3f2c1';
  const { task, project } = await resolveTask(api, query);
  if (!task.is_done) return `Already open: ☐ ${task.title} [${shortId(task.id)}]`;
  await api.updateTask(project.id, task.id, { is_done: false });
  return `☐ ${task.title} [${shortId(task.id)}]`;
}

async function cmdDue(api: FloatAPI, args: string): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) return 'Usage: due <task-id> <date/time>\nDates: today, tomorrow, monday, in 3 days, next week, 15/06\nTimes: today 18h, ce soir, tomorrow 14:00, in 2 hours';
  const id = parts[0];
  const dateStr = parts.slice(1).join(" ");

  const { task, project } = await resolveTask(api, id);
  const due = parseDate(dateStr);
  await api.updateTask(project.id, task.id, { due_date: due });
  return `${task.title} [${shortId(task.id)}] due ${relDate(due)}`;
}

async function cmdNote(api: FloatAPI, args: string): Promise<string> {
  const parts = args.match(/^(\S+)\s*([\s\S]*)/);
  if (!parts) return 'Usage: note <task-id> [action] [text]\nActions: (none)=show, append, replace, set, clear';
  const id = parts[1];
  const rest = parts[2].trim();

  const { task, project } = await resolveTask(api, id);

  if (!rest) {
    return task.description
      ? `Note for "${task.title}" [${shortId(task.id)}]:\n${task.description}`
      : `No note on "${task.title}" [${shortId(task.id)}]. Use: note ${shortId(task.id)} set "your text"`;
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
    if (!actionArgs) return 'Usage: note <id> set "your text"';
    await api.updateTask(project.id, task.id, { description: actionArgs });
    return `Note set on "${task.title}" [${shortId(task.id)}]`;
  }

  if (action === "append") {
    if (!actionArgs) return 'Usage: note <id> append "text to add"';
    const newDesc = current ? `${current}\n${actionArgs}` : actionArgs;
    await api.updateTask(project.id, task.id, { description: newDesc });
    return `Appended to note on "${task.title}" [${shortId(task.id)}]`;
  }

  if (action === "replace") {
    const replaceMatch = actionArgs.match(/^"([^"]*?)"\s+"([^"]*)"$|^'([^']*?)'\s+'([^']*)'$/);
    if (!replaceMatch) return 'Usage: note <id> replace "old text" "new text"';
    const oldText = replaceMatch[1] ?? replaceMatch[3];
    const newText = replaceMatch[2] ?? replaceMatch[4];
    if (!current.includes(oldText)) {
      return `"${oldText}" not found in note.\nCurrent note:\n${current || "(empty)"}`;
    }
    const updated = current.replace(oldText, newText);
    await api.updateTask(project.id, task.id, { description: updated });
    return `Replaced in note on "${task.title}" [${shortId(task.id)}]`;
  }

  return `Unknown note action "${action}". Use: append, replace, set, clear`;
}

async function cmdWeight(api: FloatAPI, args: string): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) return 'Usage: weight <task-id> <level>\nLevels: low, medium, high, critical';
  const id = parts[0];
  const level = parts.slice(1).join(" ");

  const { task, project } = await resolveTask(api, id);
  const weight = parseWeight(level);
  await api.updateTask(project.id, task.id, { weight });
  return `${task.title} [${shortId(task.id)}] weight → ${weight}`;
}

async function cmdLabel(api: FloatAPI, args: string): Promise<string> {
  const parts = args.match(/^(\S+)\s*([\s\S]*)/);
  if (!parts) return 'Usage: label <task-id> [action]\nActions: (none)=list, add <name>, rm <name>';
  const id = parts[1];
  const rest = parts[2].trim();

  const { task, project } = await resolveTask(api, id);
  const projectLabels = await api.getLabels(project.id);

  if (!rest || rest === "list") {
    // Show labels on this task — we need to check which labels are attached
    // The API doesn't return task labels directly, so list available project labels
    if (projectLabels.length === 0) {
      return `No labels in project "${project.title}". Use: label ${shortId(task.id)} add <name>`;
    }
    const labelList = projectLabels.map(l => `  ${l.title} (${l.color})`).join("\n");
    return `Labels in "${project.title}":\n${labelList}\nUse: label ${shortId(task.id)} add <name> / rm <name>`;
  }

  const actionMatch = rest.match(/^(add|rm|remove|del|delete)\s+([\s\S]+)/i);
  if (!actionMatch) {
    // Treat as "add" shortcut
    const name = rest;
    let label = projectLabels.find(l => normalize(l.title) === normalize(name));
    if (!label) {
      label = await api.createLabel(project.id, name);
    }
    await api.attachLabel(project.id, task.id, label.id);
    return `Tagged "${task.title}" [${shortId(task.id)}] with ${label.title}`;
  }

  const action = actionMatch[1].toLowerCase();
  const labelName = actionMatch[2].trim();

  if (action === "add") {
    let label = projectLabels.find(l => normalize(l.title) === normalize(labelName));
    if (!label) {
      label = await api.createLabel(project.id, labelName);
    }
    await api.attachLabel(project.id, task.id, label.id);
    return `Tagged "${task.title}" [${shortId(task.id)}] with ${label.title}`;
  }

  if (action === "rm" || action === "remove" || action === "del" || action === "delete") {
    const label = projectLabels.find(l => normalize(l.title) === normalize(labelName));
    if (!label) {
      const available = projectLabels.map(l => l.title).join(", ");
      return `Label "${labelName}" not found. Available: ${available || "none"}`;
    }
    await api.detachLabel(project.id, task.id, label.id);
    return `Untagged "${task.title}" [${shortId(task.id)}] from ${label.title}`;
  }

  return `Unknown label action "${action}". Use: add, rm`;
}

async function cmdMove(api: FloatAPI, args: string): Promise<string> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) return 'Usage: move <task-id> <project>\nExample: move a3f2c1 SideQuest';
  const id = parts[0];
  const projectQuery = parts.slice(1).join(" ");

  const { task, project: fromProject } = await resolveTask(api, id);
  const projects = await api.getProjects();
  const toProject = findProject(projects, projectQuery);
  if (!toProject) return projectSuggestions(projects, projectQuery);

  await api.updateTask(fromProject.id, task.id, { new_project_id: toProject.id });
  return `Moved "${task.title}" [${shortId(task.id)}] ${fromProject.title} → ${toProject.title}`;
}

async function cmdRm(api: FloatAPI, query: string): Promise<string> {
  if (!query) return 'Usage: rm <task-id or title>\nExample: rm a3f2c1';
  const { task, project } = await resolveTask(api, query);
  await api.deleteTask(project.id, task.id);
  return `Deleted: ${task.title} [${shortId(task.id)}] from ${project.title}`;
}
