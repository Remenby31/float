import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { SaveShortcut, TaskMention } from '@/features/workspace/editor/extensions';
import { isHtml, migrateToHtml } from '@/features/workspace/editor/migrate';

export interface NoteEditorHandle {
  save: () => Promise<boolean>;
  hasUnsavedChanges: () => boolean;
}

interface NoteEditorProps {
  content: string;
  placeholder?: string;
  onSave: (html: string) => void | Promise<void>;
  ref?: Ref<NoteEditorHandle>;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function NoteEditor({ content, placeholder = 'Add context, a next step, or a useful link…', onSave, ref }: NoteEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef(onSave);
  const draftRef = useRef('');
  const savedRef = useRef('');
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [empty, setEmpty] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [marks, setMarks] = useState({ bold: false, italic: false, bullet: false, ordered: false });

  useEffect(() => { saveRef.current = onSave; }, [onSave]);

  // Blur, the idle timer and Cmd/Ctrl+S join a single writer. Changes made
  // during a request are drained afterwards, never sent out of order.
  const save = useCallback((): Promise<boolean> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingRef.current) return pendingRef.current;
    if (draftRef.current === savedRef.current) return Promise.resolve(true);

    setSaveState('saving');
    const persist = async () => {
      try {
        while (draftRef.current !== savedRef.current) {
          const snapshot = draftRef.current;
          await saveRef.current(snapshot);
          savedRef.current = snapshot;
        }
        if (mountedRef.current) setSaveState('saved');
        return true;
      } catch {
        // Query rolls the server value back; the editor keeps the local draft.
        if (mountedRef.current) setSaveState('error');
        return false;
      } finally {
        pendingRef.current = null;
      }
    };
    pendingRef.current = Promise.resolve().then(persist);
    return pendingRef.current;
  }, []);

  useImperativeHandle(ref, () => ({
    save,
    hasUnsavedChanges: () => draftRef.current !== savedRef.current || Boolean(pendingRef.current),
  }), [save]);

  const editor = useEditor({
    immediatelyRender: false,
    // Native Tab must leave the editor so keyboard users can reach attachments
    // and the footer. StarterKit retains list indentation in list items.
    extensions: [StarterKit, TaskMention, SaveShortcut],
    content: processContent(content),
    editorProps: {
      attributes: { 'data-placeholder': placeholder, 'aria-label': 'Task notes', role: 'textbox', 'aria-multiline': 'true' },
    },
    onCreate: ({ editor: currentEditor }) => {
      draftRef.current = savedRef.current = cleanHtml(currentEditor.getHTML());
      setEmpty(currentEditor.isEmpty);
    },
    onUpdate: ({ editor: currentEditor, transaction }) => {
      const html = cleanHtml(currentEditor.getHTML());
      // StarterKit appends an editable paragraph after a terminal list/heading
      // when the first selection/focus transaction runs. That root transaction
      // does not edit the document: adopt normalization as the clean baseline.
      // Genuine Enter/typing transactions remain dirty, including blank lines.
      if (!transaction.docChanged && !pendingRef.current && draftRef.current === savedRef.current) {
        draftRef.current = savedRef.current = html;
        setEmpty(currentEditor.isEmpty);
        return;
      }
      draftRef.current = html;
      setEmpty(currentEditor.isEmpty);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) {
        setSaveState('saving');
      } else if (draftRef.current === savedRef.current) {
        setSaveState('saved');
      } else {
        setSaveState('dirty');
        timerRef.current = setTimeout(() => void save(), 700);
      }
    },
    onBlur: () => { void save(); },
    onTransaction: ({ editor: currentEditor }) => {
      setMarks({
        bold: currentEditor.isActive('bold'),
        italic: currentEditor.isActive('italic'),
        bullet: currentEditor.isActive('bulletList'),
        ordered: currentEditor.isActive('orderedList'),
      });
    },
  });

  useEffect(() => {
    if (!editor || pendingRef.current || draftRef.current !== savedRef.current) return;
    const processed = processContent(content);
    if (cleanHtml(processed) !== cleanHtml(editor.getHTML())) {
      editor.commands.setContent(processed, { emitUpdate: false });
      draftRef.current = savedRef.current = cleanHtml(editor.getHTML());
      queueMicrotask(() => { if (mountedRef.current) setEmpty(editor.isEmpty); });
    }
  }, [content, editor]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || !editor) return;
    const onEditorSave = () => { void save(); };
    element.addEventListener('chip-toggled', onEditorSave);
    element.addEventListener('editor-save', onEditorSave);
    return () => {
      element.removeEventListener('chip-toggled', onEditorSave);
      element.removeEventListener('editor-save', onEditorSave);
    };
  }, [editor, save]);

  useEffect(() => {
    mountedRef.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (draftRef.current === savedRef.current && !pendingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`note-editor detail-note-editor ${empty ? 'is-empty' : ''}`}>
      <div aria-label="Text formatting" className="detail-note-toolbar" role="toolbar">
        <ToolbarButton active={marks.bold} disabled={!editor} label="bold" onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></ToolbarButton>
        <ToolbarButton active={marks.italic} disabled={!editor} label="italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>
        <span aria-hidden="true" className="detail-toolbar-rule" />
        <ToolbarButton active={marks.bullet} disabled={!editor} label="bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}>• ≡</ToolbarButton>
        <ToolbarButton active={marks.ordered} disabled={!editor} label="ordered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. ≡</ToolbarButton>
        <span className="detail-format-hint">A little context helps.</span>
      </div>
      {editor ? <EditorContent className="detail-note-content" editor={editor} /> : <p className="detail-muted">Loading notes…</p>}
      <div className={`detail-note-status ${saveState === 'error' ? 'is-error' : ''}`}>
        <span aria-live="polite" role="status">
          {saveState === 'idle' ? 'Autosaves as you write' : saveState === 'dirty' ? 'Unsaved changes' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : 'Could not save notes. Your draft is still here.'}
        </span>
        {saveState === 'error' ? <button className="detail-text-button" onClick={() => void save()} type="button">Retry save</button> : <span className="detail-save-shortcut">⌘ / Ctrl S</span>}
      </div>
    </div>
  );
}

function ToolbarButton({ active, disabled, label, onClick, children }: { active: boolean; disabled: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="detail-format-button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function cleanHtml(value: string) { return value === '<p></p>' ? '' : value; }

function processContent(value: string): string {
  if (!value) return '';
  return isHtml(value) ? value : migrateToHtml(value);
}
