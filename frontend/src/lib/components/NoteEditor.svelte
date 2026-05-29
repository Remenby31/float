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
	}

	.note-editor :global(.ProseMirror) {
		outline: none;
		min-height: 200px;
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
