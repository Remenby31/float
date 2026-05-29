import { Node, mergeAttributes, type NodeViewRenderer } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const TaskMention = Node.create({
	name: 'taskMention',
	group: 'block',
	atom: true,

	addAttributes() {
		return {
			id: {
				default: 'task',
				parseHTML: (el: HTMLElement) => el.getAttribute('data-id') || el.getAttribute('id') || 'task',
				renderHTML: (attrs: Record<string, string>) => ({ 'data-id': attrs.id }),
			},
			label: {
				default: '',
				parseHTML: (el: HTMLElement) => el.getAttribute('data-label') || el.getAttribute('label') || '',
				renderHTML: (attrs: Record<string, string>) => ({ 'data-label': attrs.label }),
			},
		};
	},

	parseHTML() {
		return [
			{ tag: 'div[data-type="taskMention"]' },
			{ tag: 'span[data-type="taskMention"]' },
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, { 'data-type': 'taskMention' }),
			'\u200B',
		];
	},

	addNodeView(): NodeViewRenderer {
		return ({ node, editor, getPos }) => {
			const dom = document.createElement('div');
			dom.contentEditable = 'false';
			dom.dataset.type = 'taskMention';

			const checkbox = document.createElement('div');
			checkbox.className = 'todo-checkbox';

			const label = document.createElement('span');
			label.className = 'todo-label';

			dom.appendChild(checkbox);
			dom.appendChild(label);

			function render() {
				const isDone = node.attrs.id === 'done';
				dom.className = `todo-item ${isDone ? 'is-done' : ''}`;
				checkbox.innerHTML = isDone
					? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>'
					: '';
				label.textContent = node.attrs.label;
			}

			render();

			checkbox.addEventListener('click', (e) => {
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
						const insertPos = tr.mapping.map(lineStart);
						tr.insert(insertPos, nodeType.create({ id, label }));
						view.dispatch(tr);
						return true;
					},
				},
			}),
		];
	},
});
