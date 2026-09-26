import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { SaveShortcut, TabIndent, TaskMention } from '@/features/workspace/editor/extensions';
import { isHtml, migrateToHtml } from '@/features/workspace/editor/migrate';

interface NoteEditorProps {
  content: string;
  placeholder?: string;
  onSave: (html: string) => void | Promise<void>;
}

export function NoteEditor({ content, placeholder = 'write something...', onSave }: NoteEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef(onSave);
  const [empty, setEmpty] = useState(true);
  const [toolbar, setToolbar] = useState<{ left: number; top: number } | null>(null);
  const [marks, setMarks] = useState({ bold: false, italic: false, bullet: false, ordered: false });

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const save = useCallback((html: string) => {
    const cleaned = html === '<p></p>' ? '' : html;
    void saveRef.current(cleaned);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskMention,
      TabIndent,
      SaveShortcut,
    ],
    content: processContent(content),
    editorProps: { attributes: { 'data-placeholder': placeholder, 'aria-label': 'Task notes', role: 'textbox', 'aria-multiline': 'true' } },
    onCreate: ({ editor: currentEditor }) => setEmpty(currentEditor.isEmpty),
    onUpdate: ({ editor: currentEditor }) => setEmpty(currentEditor.isEmpty),
    onBlur: ({ editor: currentEditor }) => {
      save(currentEditor.getHTML());
      setToolbar(null);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection;
      if (from === to || !wrapperRef.current) {
        setToolbar(null);
        return;
      }
      const coordinates = currentEditor.view.coordsAtPos(from);
      const wrapper = wrapperRef.current.getBoundingClientRect();
      setMarks({
        bold: currentEditor.isActive('bold'),
        italic: currentEditor.isActive('italic'),
        bullet: currentEditor.isActive('bulletList'),
        ordered: currentEditor.isActive('orderedList'),
      });
      setToolbar({ left: Math.max(0, coordinates.left - wrapper.left), top: Math.max(0, coordinates.top - wrapper.top - 38) });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const processed = processContent(content);
    if (processed !== editor.getHTML()) {
      editor.commands.setContent(processed, { emitUpdate: false });
      queueMicrotask(() => setEmpty(editor.isEmpty));
    }
  }, [content, editor]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || !editor) return;
    const onChipToggle = () => save(editor.getHTML());
    const onEditorSave = () => save(editor.getHTML());
    element.addEventListener('chip-toggled', onChipToggle);
    element.addEventListener('editor-save', onEditorSave);
    return () => {
      element.removeEventListener('chip-toggled', onChipToggle);
      element.removeEventListener('editor-save', onEditorSave);
    };
  }, [editor, save]);

  if (!editor) return <div className="note-editor" />;

  return (
    <div ref={wrapperRef} className={`note-editor ${empty ? 'is-empty' : ''}`}>
      <EditorContent className="flex min-h-full flex-1" editor={editor} />
      {toolbar ? (
        <div aria-label="Text formatting" className="popover-panel absolute z-20 flex items-center gap-0.5 px-1 py-0.5" role="toolbar" style={toolbar}>
          <ToolbarButton active={marks.bold} label="bold" onMouseDown={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolbarButton>
          <ToolbarButton active={marks.italic} label="italic" onMouseDown={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToolbarButton active={marks.bullet} label="bullet list" onMouseDown={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
          <ToolbarButton active={marks.ordered} label="ordered list" onMouseDown={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({ active, label, onMouseDown, children }: { active: boolean; label: string; onMouseDown: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-sm text-xs ${active ? 'bg-surface text-accent' : 'text-text-muted hover:text-text'}`}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function processContent(value: string): string {
  if (!value) return '';
  return isHtml(value) ? value : migrateToHtml(value);
}
