<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { TaskMention, TabIndent, SaveShortcut, isHtml, migrateToHtml } from '$lib/editor';

	let {
		content = '',
		placeholder = 'write something...',
		onSave,
	}: {
		content: string;
		placeholder?: string;
		onSave: (html: string) => void;
	} = $props();

	let editorElement: HTMLDivElement;
	let editor: Editor | null = $state(null);
	let isEmpty = $state(true);

	function processContent(raw: string): string {
		if (!raw) return '';
		return isHtml(raw) ? raw : migrateToHtml(raw);
	}

	function handleSave() {
		if (!editor) return;
		const html = editor.getHTML();
		const cleaned = html === '<p></p>' ? '' : html;
		onSave(cleaned);
	}

	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit,
				TaskMention,
				TabIndent,
				SaveShortcut.configure({ onSave: handleSave }),
			],
			content: processContent(content),
			editorProps: {
				attributes: {
					'data-placeholder': placeholder,
				},
			},
			onBlur: () => handleSave(),
			onUpdate: ({ editor: e }) => {
				isEmpty = e.isEmpty;
			},
		});
		isEmpty = editor.isEmpty;

		editorElement.addEventListener('chip-toggled', handleSave);
	});

	onDestroy(() => {
		editorElement?.removeEventListener('chip-toggled', handleSave);
		editor?.destroy();
	});

	// Update editor content when parent switches tasks
	let lastContent = content;
	$effect(() => {
		if (editor && content !== lastContent) {
			lastContent = content;
			const processed = processContent(content);
			const current = editor.getHTML();
			if (processed !== current) {
				editor.commands.setContent(processed);
				isEmpty = editor.isEmpty;
			}
		}
	});
</script>

<div
	bind:this={editorElement}
	class="note-editor"
	class:is-empty={isEmpty}
></div>

<style>
	.note-editor {
		width: 100%;
		flex: 1;
		min-height: 200px;
		display: flex;
		flex-direction: column;
	}

	.note-editor :global(.tiptap) {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.note-editor :global(.ProseMirror) {
		outline: none;
		flex: 1;
		font-size: 0.875rem;
		line-height: 1.625;
		color: var(--color-text);
		font-family: var(--font-sans);
		tab-size: 2;
	}

	.note-editor :global(.ProseMirror p) {
		margin: 0;
	}

	.note-editor.is-empty :global(.ProseMirror p:first-child::before) {
		content: attr(data-placeholder);
		color: var(--color-text-muted);
		opacity: 0.4;
		pointer-events: none;
		float: left;
		height: 0;
	}

	.note-editor :global(.ProseMirror strong) {
		font-weight: 600;
	}

	.note-editor :global(.ProseMirror em) {
		font-style: italic;
	}

	/* Lists */
	.note-editor :global(.ProseMirror ul) {
		list-style-type: disc;
		padding-left: 1.5em;
		margin: 0.25em 0;
	}

	.note-editor :global(.ProseMirror ol) {
		list-style-type: decimal;
		padding-left: 1.5em;
		margin: 0.25em 0;
	}

	.note-editor :global(.ProseMirror li) {
		margin: 0.1em 0;
	}

	.note-editor :global(.ProseMirror li p) {
		margin: 0;
	}

	/* Nested lists */
	.note-editor :global(.ProseMirror ul ul) {
		list-style-type: circle;
	}

	.note-editor :global(.ProseMirror ul ul ul) {
		list-style-type: square;
	}

	/* Blockquotes */
	.note-editor :global(.ProseMirror blockquote) {
		border-left: 3px solid var(--color-border-strong);
		padding-left: 1em;
		margin: 0.5em 0;
		color: var(--color-text-muted);
	}

	/* Code blocks */
	.note-editor :global(.ProseMirror pre) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0.75em 1em;
		margin: 0.5em 0;
		overflow-x: auto;
	}

	.note-editor :global(.ProseMirror pre code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8125rem;
		color: var(--color-text);
		background: none;
		padding: 0;
	}

	/* Inline code */
	.note-editor :global(.ProseMirror code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8125rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.1em 0.3em;
	}

	/* Headings */
	.note-editor :global(.ProseMirror h1) {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0.75em 0 0.25em;
	}

	.note-editor :global(.ProseMirror h2) {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0.5em 0 0.2em;
	}

	.note-editor :global(.ProseMirror h3) {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0.4em 0 0.15em;
	}

	/* Horizontal rule */
	.note-editor :global(.ProseMirror hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 1em 0;
	}

	/* To-do items (Notion style) */
	.note-editor :global(.todo-item) {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 3px 0;
		user-select: none;
	}

	.note-editor :global(.todo-checkbox) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		margin-top: 2px;
		border-radius: 3px;
		border: 1.5px solid var(--color-text-muted);
		flex-shrink: 0;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.note-editor :global(.todo-checkbox:hover) {
		border-color: var(--color-info);
		background: var(--color-info)/10;
	}

	.note-editor :global(.todo-item.is-done .todo-checkbox) {
		background: var(--color-info);
		border-color: var(--color-info);
		color: white;
	}

	.note-editor :global(.todo-label) {
		color: var(--color-text);
		font-size: 0.875rem;
		line-height: 1.625;
	}

	.note-editor :global(.todo-item.is-done .todo-label) {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}
</style>
