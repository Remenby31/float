const TASK_RE = /^@task\s+(.+)$|^(.+)\s+@task$/i;
const DONE_RE = /^@done\s+(.+)$|^(.+)\s+@done$/i;

export function isHtml(content: string): boolean {
  return content.trimStart().startsWith('<');
}

export function migrateToHtml(plainText: string): string {
  return plainText
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<p></p>';
      const taskMatch = trimmed.match(TASK_RE);
      if (taskMatch) {
        const label = (taskMatch[1] || taskMatch[2]).trim();
        return `<div data-type="taskMention" data-id="task" data-label="${escapeAttribute(label)}">\u200B</div>`;
      }
      const doneMatch = trimmed.match(DONE_RE);
      if (doneMatch) {
        const label = (doneMatch[1] || doneMatch[2]).trim();
        return `<div data-type="taskMention" data-id="done" data-label="${escapeAttribute(label)}">\u200B</div>`;
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
