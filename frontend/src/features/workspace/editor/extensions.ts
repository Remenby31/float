import { Extension, mergeAttributes, Node, type NodeViewRenderer } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const SaveShortcut = Extension.create({
  name: 'saveShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        this.editor.view.dom.dispatchEvent(new Event('editor-save', { bubbles: true }));
        return true;
      },
    };
  },
});

export const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('listItem')) return this.editor.commands.sinkListItem('listItem');
        this.editor.commands.insertContent('\t');
        return true;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem')) return this.editor.commands.liftListItem('listItem');
        const { state, dispatch } = this.editor.view;
        const lineStart = state.selection.$from.start();
        const textBefore = state.doc.textBetween(lineStart, state.selection.$from.pos);
        if (!textBefore.startsWith('\t')) return false;
        dispatch(state.tr.delete(lineStart, lineStart + 1));
        return true;
      },
    };
  },
});

export const TaskMention = Node.create({
  name: 'taskMention',
  priority: 200,
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: {
        default: 'task',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-id') || element.getAttribute('id') || 'task',
        renderHTML: (attributes: Record<string, string>) => ({ 'data-id': attributes.id }),
      },
      label: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label') || element.getAttribute('label') || '',
        renderHTML: (attributes: Record<string, string>) => ({ 'data-label': attributes.label }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="taskMention"]' }, { tag: 'span[data-type="taskMention"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'taskMention' }), '\u200B'];
  },
  addNodeView(): NodeViewRenderer {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      const dom = document.createElement('div');
      dom.contentEditable = 'false';
      dom.dataset.type = 'taskMention';
      const checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className = 'todo-checkbox touch-target';
      const label = document.createElement('span');
      label.className = 'todo-label';
      dom.append(checkbox, label);

      const render = () => {
        const isDone = currentNode.attrs.id === 'done';
        checkbox.setAttribute('aria-label', `Toggle ${currentNode.attrs.label}`);
        checkbox.setAttribute('aria-pressed', String(isDone));
        dom.className = `todo-item ${isDone ? 'is-done' : ''}`;
        checkbox.innerHTML = isDone
          ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>'
          : '';
        label.textContent = currentNode.attrs.label;
      };
      render();

      checkbox.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const position = typeof getPos === 'function' ? getPos() : undefined;
        if (position === undefined) return;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            id: currentNode.attrs.id === 'done' ? 'task' : 'done',
          }),
        );
        dom.dispatchEvent(new Event('chip-toggled', { bubbles: true }));
      });

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'taskMention') return false;
          currentNode = updatedNode;
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
            const parentNode = view.state.selection.$from.parent;
            if (!parentNode.isTextblock) return false;
            const match = parentNode.textContent.match(/^@(task|step|done)\s+(.+)$/i);
            if (!match) return false;
            const id = match[1].toLowerCase() === 'done' ? 'done' : 'task';
            const { $from } = view.state.selection;
            view.dispatch(
              view.state.tr.replaceWith($from.before(), $from.after(), nodeType.create({ id, label: match[2].trim() })),
            );
            return true;
          },
        },
      }),
    ];
  },
});
