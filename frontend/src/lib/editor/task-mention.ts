import { Node, mergeAttributes, type NodeViewRenderer } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const TaskMention = Node.create({
	name: 'taskMention',
	group: 'inline',
	inline: true,
	atom: true,

	addAttributes() {
		return {
			id: { default: 'task' },
			label: { default: '' },
		};
	},

	parseHTML() {
		return [{ tag: 'span[data-type="taskMention"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'span',
			mergeAttributes(HTMLAttributes, { 'data-type': 'taskMention' }),
			'\u200B',
		];
	},

	addNodeView(): NodeViewRenderer {
		return ({ node, editor, getPos }) => {
			const dom = document.createElement('span');
			dom.contentEditable = 'false';
			dom.dataset.type = 'taskMention';

			function render() {
				const isDone = node.attrs.id === 'done';
				dom.className = `task-chip ${isDone ? 'is-done' : ''}`;
				dom.innerHTML = `<span class="task-chip-check">${
					isDone
						? '<svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>'
						: ''
				}</span><span class="task-chip-label">${escapeHtml(node.attrs.label)}</span>`;
			}

			render();

			dom.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const pos = typeof getPos === 'function' ? getPos() : null;
				if (pos == null) return;
				const newId = node.attrs.id === 'done' ? 'task' : 'done';
				editor.view.dispatch(
					editor.state.tr.setNodeMarkup(pos, undefined, {
						...node.attrs,
						id: newId,
					})
				);
				dom.dispatchEvent(new Event('chip-toggled', { bubbles: true }));
			});

			return {
				dom,
				update(updatedNode) {
					if (updatedNode.type.name !== 'taskMention') return false;
					node = updatedNode;
					render();
					return true;
				},
				stopEvent: () => true,
			};
		};
	},

	addProseMirrorPlugins() {
		const nodeType = this.type;
		return [
			new Plugin({
				key: new PluginKey('taskMentionInput'),
				props: {
					handleKeyDown(view, event) {
						if (event.key !== 'Enter') return false;

						const { state } = view;
						const { $from } = state.selection;
						const lineStart = $from.start();
						const lineText = state.doc.textBetween(lineStart, $from.pos);

						const taskRe = /^@(task|done)\s+(.+)$/i;
						const match = lineText.match(taskRe);
						if (!match) return false;

						const id = match[1].toLowerCase();
						const label = match[2].trim();

						const tr = state.tr;
						tr.delete(lineStart, $from.pos);
						tr.insert(
							lineStart,
							nodeType.create({ id, label })
						);
						// Add a new paragraph after the chip
						tr.split(tr.mapping.map($from.pos));
						view.dispatch(tr);
						return true;
					},
				},
			}),
		];
	},
});

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
