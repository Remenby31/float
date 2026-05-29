const TASK_RE = /^@task\s+(.+)$|^(.+)\s+@task$/i;
const DONE_RE = /^@done\s+(.+)$|^(.+)\s+@done$/i;

export function isHtml(content: string): boolean {
	return content.trimStart().startsWith('<');
}

export function migrateToHtml(plainText: string): string {
	const lines = plainText.split('\n');
	return lines
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return '<p></p>';

			const taskMatch = trimmed.match(TASK_RE);
			if (taskMatch) {
				const label = (taskMatch[1] || taskMatch[2]).trim();
				return `<p><span data-type="taskMention" data-id="task" data-label="${escapeAttr(label)}">\u200B</span></p>`;
			}

			const doneMatch = trimmed.match(DONE_RE);
			if (doneMatch) {
				const label = (doneMatch[1] || doneMatch[2]).trim();
				return `<p><span data-type="taskMention" data-id="done" data-label="${escapeAttr(label)}">\u200B</span></p>`;
			}

			return `<p>${escapeHtml(line)}</p>`;
		})
		.join('');
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
