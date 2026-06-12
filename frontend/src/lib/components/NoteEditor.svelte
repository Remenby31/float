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
	let toolbarPos = $state<{ x: number; y: number } | null>(null);
	let isBold = $state(false);
	let isItalic = $state(false);
	let isBulletList = $state(false);
	let isOrderedList = $state(false);

	function updateToolbar() {
		if (!editor) return;
		const { from, to } = editor.state.selection;
		if (from === to) { toolbarPos = null; return; }
		isBold = editor.isActive('bold');
		isItalic = editor.isActive('italic');
		isBulletList = editor.isActive('bulletList');
		isOrderedList = editor.isActive('orderedList');
		const dom = editor.view.coordsAtPos(from);
		const parentRect = editorElement.getBoundingClientRect();
		toolbarPos = { x: dom.left - parentRect.left, y: dom.top - parentRect.top - 36 };
	}

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
			onBlur: () => { handleSave(); toolbarPos = null; },
			onUpdate: ({ editor: e }) => {
				isEmpty = e.isEmpty;
			},
			onSelectionUpdate: () => updateToolbar(),
		});
		isEmpty = editor.isEmpty;

		editorElement.addEventListener('chip-toggled', handleSave);
	});

	onDestroy(() => {
		editorElement?.removeEventListener('chip-toggled', handleSave);
		editor?.destroy();
	});

	let lastContent = $state(content);
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

<div class="note-editor-wrapper">
	<div
		bind:this={editorElement}
		class="note-editor"
		class:is-empty={isEmpty}
	></div>

	<!-- Floating toolbar -->
	{#if toolbarPos && editor}
		<div
			class="absolute z-10 flex items-center gap-0.5 bg-elevated border border-border rounded-lg shadow-lg px-1 py-0.5"
			style="left:{Math.max(0, toolbarPos.x)}px; top:{Math.max(0, toolbarPos.y)}px"
		>
			<button type="button" onmousedown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }} class="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors {isBold ? 'bg-surface text-text' : 'text-text-muted hover:text-text'}" aria-label="bold"><strong>B</strong></button>
			<button type="button" onmousedown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} class="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors {isItalic ? 'bg-surface text-text' : 'text-text-muted hover:text-text'}" aria-label="italic"><em>I</em></button>
			<div class="w-px h-4 bg-border mx-0.5"></div>
			<button type="button" onmousedown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }} class="w-6 h-6 rounded flex items-center justify-center transition-colors {isBulletList ? 'bg-surface text-text' : 'text-text-muted hover:text-text'}">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
			</button>
			<button type="button" onmousedown={(e) => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }} class="w-6 h-6 rounded flex items-center justify-center transition-colors {isOrderedList ? 'bg-surface text-text' : 'text-text-muted hover:text-text'}">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" font-size="8" fill="currentColor" stroke="none">1</text><text x="2" y="14" font-size="8" fill="currentColor" stroke="none">2</text><text x="2" y="20" font-size="8" fill="currentColor" stroke="none">3</text></svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.note-editor-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 200px;
	}

	.note-editor {
		width: 100%;
		flex: 1;
		display: flex;
		flex-direction: column;
		cursor: text;
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
		opacity: 0.6;
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
