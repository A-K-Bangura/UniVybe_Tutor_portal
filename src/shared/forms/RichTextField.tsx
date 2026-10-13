import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { useState } from "react";
import { safeMediaUrl } from "../media/urls";
export default function RichTextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [addingLink, setAddingLink] = useState(false),
    [link, setLink] = useState(""),
    [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
    ],
    content: DOMPurify.sanitize(value, { USE_PROFILES: { html: true } }),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Post content",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  return (
    <div className="rich-editor">
      <div className="actions">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button type="button" onClick={() => setAddingLink(!addingLink)}>
          Add link
        </button>
      </div>
      {addingLink && (
        <div className="rich-link-editor">
          <label>
            Link URL
            <input
              aria-label="Post link URL"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError("");
              }}
              placeholder="https://…"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const url = safeMediaUrl(link);
              if (!url) {
                setLinkError("Enter a valid HTTP or HTTPS link.");
                return;
              }
              if (editor?.state.selection.empty)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: url.href,
                    marks: [
                      {
                        type: "link",
                        attrs: {
                          href: url.href,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                      },
                    ],
                  })
                  .run();
              else editor?.chain().focus().setLink({ href: url.href }).run();
              setAddingLink(false);
              setLink("");
              setLinkError("");
            }}
          >
            Insert link
          </button>
          {linkError && (
            <p className="field-error" role="alert">
              {linkError}
            </p>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
