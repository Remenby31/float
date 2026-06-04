import { Extension } from '@tiptap/core';

export const TabIndent = Extension.create({
	name: 'tabIndent',

	addKeyboardShortcuts() {
		return {
			Tab: () => {
				// If inside a list, use native list sink (indent)
				if (this.editor.isActive('listItem')) {
					return this.editor.commands.sinkListItem('listItem');
				}
				this.editor.commands.insertContent('\t');
				return true;
			},
			'Shift-Tab': () => {
				// If inside a list, use native list lift (outdent)
				if (this.editor.isActive('listItem')) {
					return this.editor.commands.liftListItem('listItem');
				}
				const { state, dispatch } = this.editor.view;
				const { $from } = state.selection;
				const lineStart = $from.start();
				const textBefore = state.doc.textBetween(lineStart, $from.pos);

				if (textBefore.startsWith('\t')) {
					dispatch(state.tr.delete(lineStart, lineStart + 1));
					return true;
				}
				return false;
			},
		};
	},
});
