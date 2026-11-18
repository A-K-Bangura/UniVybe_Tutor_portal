import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Unlink,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  RemoveFormatting,
  IndentIncrease,
  IndentDecrease,
} from "lucide-react";
import {
  lessonDocument,
  lessonExtensions,
  lessonHtml,
  richLink,
} from "./richText";

export function LessonRichText({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const editor = useEditor({
    extensions: lessonExtensions(),
    content: lessonDocument(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id: "block-content",
        role: "textbox",
        "aria-label": "Content",
        "aria-multiline": "true",
      },
      transformPastedHTML: lessonHtml,
    },
    onUpdate: ({ editor }) =>
      onChange(editor.isEmpty ? "" : lessonHtml(editor.getHTML())),
  });
  useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            selection: editor.state.selection,
            doc: editor.state.doc,
            marks: editor.state.storedMarks,
          }
        : null,
  });
  useEffect(() => {
    if (
      editor &&
      value !== (editor.isEmpty ? "" : lessonHtml(editor.getHTML()))
    )
      editor.commands.setContent(lessonDocument(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    editor?.view.dom.setAttribute("aria-invalid", String(invalid));
  }, [editor, invalid]);
  if (!editor) return null;
  const actions = [
    {
      label: "Bold (Ctrl/Cmd+B)",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic (Ctrl/Cmd+I)",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline (Ctrl/Cmd+U)",
      icon: Underline,
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Inline code",
      icon: Code,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Indent list",
      icon: IndentIncrease,
      disabled: !editor.can().sinkListItem("listItem"),
      run: () => editor.chain().focus().sinkListItem("listItem").run(),
    },
    {
      label: "Outdent list",
      icon: IndentDecrease,
      disabled: !editor.can().liftListItem("listItem"),
      run: () => editor.chain().focus().liftListItem("listItem").run(),
    },
    {
      label: "Blockquote",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    ...(["left", "center", "right"] as const).map((align, i) => ({
      label: `Align ${align}`,
      icon: [AlignLeft, AlignCenter, AlignRight][i],
      active: editor.isActive({ textAlign: align }),
      run: () =>
        editor
          .chain()
          .focus()
          .updateAttributes("paragraph", { textAlign: align })
          .updateAttributes("heading", { textAlign: align })
          .run(),
    })),
    {
      label: "Edit link",
      icon: Link,
      active: editor.isActive("link"),
      run: () => {
        setUrl(String(editor.getAttributes("link").href || ""));
        setError("");
        setLinkOpen(true);
      },
    },
    {
      label: "Remove link",
      icon: Unlink,
      disabled: !editor.isActive("link"),
      run: () =>
        editor.chain().focus().extendMarkRange("link").unsetLink().run(),
    },
    {
      label: "Undo",
      icon: Undo2,
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      icon: Redo2,
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
    {
      label: "Clear formatting",
      icon: RemoveFormatting,
      run: () =>
        editor
          .chain()
          .focus()
          .unsetAllMarks()
          .clearNodes()
          .updateAttributes("paragraph", { textAlign: "left" })
          .run(),
    },
  ];
  return (
    <div className="rich-editor lesson-rich-editor">
      <div className="lesson-toolbar" role="group" aria-label="Text formatting">
        <select
          aria-label="Paragraph style"
          disabled={disabled}
          value={
            editor.isActive("heading")
              ? String(editor.getAttributes("heading").level)
              : "p"
          }
          onChange={(event) => {
            const level = Number(event.target.value) as 2 | 3 | 4;
            if (event.target.value === "p")
              editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level }).run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="4">Heading 4</option>
        </select>
        {actions.map(
          ({ label, icon: Icon, active, disabled: unavailable, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              disabled={disabled || unavailable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          ),
        )}
      </div>
      {linkOpen && (
        <div className="rich-link-editor">
          <label>
            Link URL
            <input
              autoFocus
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
                if (event.key === "Escape") {
                  setLinkOpen(false);
                  editor.commands.focus();
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const href = richLink(url);
              if (!href) {
                setError(
                  "Enter an HTTP or HTTPS URL without credentials or spaces.",
                );
                return;
              }
              if (editor.state.selection.empty && !editor.isActive("link"))
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: href,
                    marks: [{ type: "link", attrs: { href } }],
                  })
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href })
                  .run();
              setLinkOpen(false);
            }}
          >
            Apply link
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              editor.commands.focus();
            }}
          >
            Cancel
          </button>
          {error && (
            <small role="alert" className="field-error">
              {error}
            </small>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      <small className="muted">
        Select text to format it. Shift+Enter adds a line break.
      </small>
    </div>
  );
}
