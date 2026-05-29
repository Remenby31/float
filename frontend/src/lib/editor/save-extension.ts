import { Extension } from '@tiptap/core';

export const SaveShortcut = Extension.create({
	name: 'saveShortcut',

	addOptions() {
		return { onSave: () => {} };
	},

	addKeyboardShortcuts() {
		return {
			'Mod-s': () => {
				this.options.onSave();
				return true;
			},
		};
	},
});
