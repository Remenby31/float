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

	/* Task mention chips */
	.note-editor :global(.task-chip) {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 8px 1px 4px;
		border-radius: 6px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		cursor: pointer;
		user-select: none;
		vertical-align: baseline;
		font-size: 0.8125rem;
		line-height: 1.5;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.note-editor :global(.task-chip:hover) {
		border-color: var(--color-border-strong);
		background: var(--color-elevated);
	}

	.note-editor :global(.task-chip-check) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1.5px solid var(--color-border-strong);
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	.note-editor :global(.task-chip.is-done .task-chip-check) {
		background: var(--color-success);
		border-color: var(--color-success);
		color: white;
	}

	.note-editor :global(.task-chip-label) {
		color: var(--color-text);
	}

	.note-editor :global(.task-chip.is-done .task-chip-label) {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}
</style>
